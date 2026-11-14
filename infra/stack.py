"""The core stack (ADR-0017): data and releases buckets, the tick function, its schedule, the
first-deployment alarms and the alert topic. Hosting is S2; the CI stack and budget are S4."""

import tempfile
from dataclasses import dataclass
from functools import cache

from aws_cdk import Duration, RemovalPolicy, Stack, TimeZone
from aws_cdk import aws_cloudwatch as cw
from aws_cdk import aws_cloudwatch_actions as cw_actions
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_scheduler as scheduler
from aws_cdk import aws_scheduler_targets as targets
from aws_cdk import aws_sns as sns

from infra import package
from lambdas import tick as T
from lambdas.tick import iso, load_config
from sim import rules as R

STAGES = ("dev", "prod")
KEYS = ("seed", "genesis", "alert_email", "reserved_concurrency")
HANDLER = "lambdas.tick.handler"


@dataclass(frozen=True)
class StageConfig:
    stage: str
    seed: int
    genesis: str  # ISO 8601 UTC, as the handler reads it
    alert_email: str
    reserved_concurrency: bool

    @property
    def prod(self):
        return self.stage == "prod"


def stage_config(stage, get):
    """The stage's values from CDK context (`get(key)`, keys `<stage>.<name>`), checked with the
    handler's own parser so a bad seed or genesis fails at synth, not in the first tick."""
    raw = {k: get(f"{stage}.{k}") for k in KEYS}
    missing = [f"{stage}.{k}" for k in ("seed", "genesis", "alert_email") if raw[k] in (None, "")]
    if missing:
        raise ValueError(f"missing CDK context: {', '.join(missing)} (pass with -c key=value)")
    cfg = load_config(
        {
            "VEKTOR9_SEED": str(raw["seed"]),
            "VEKTOR9_GENESIS": raw["genesis"],
            "VEKTOR9_STAGE": stage,
        }
    )
    email = str(raw["alert_email"])
    if "@" not in email:
        raise ValueError(f"{stage}.alert_email is not an email address")
    reserved = str(raw["reserved_concurrency"] or "false").lower()
    if reserved not in ("true", "false"):
        raise ValueError(f"{stage}.reserved_concurrency must be true or false, got {reserved!r}")
    return StageConfig(stage, cfg.seed, iso(cfg.genesis), email, reserved == "true")


_staging = []  # TemporaryDirectory objects, removed when the process exits


@cache
def code_dir():
    """The staged package, once per process. The asset hash is of its contents, not its path."""
    _staging.append(tempfile.TemporaryDirectory(prefix="vektor9-tick-"))
    return str(package.stage(_staging[-1].name))


class CoreStack(Stack):
    def __init__(self, scope, construct_id, *, config, **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        removal = RemovalPolicy.RETAIN if config.prod else RemovalPolicy.DESTROY

        private = dict(
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=config.prod,
            removal_policy=removal,
        )
        # dev: no autoDeleteObjects (its provider function would have no log group with
        # retention); destroying dev means emptying the unversioned buckets first
        head_versions = s3.LifecycleRule(
            id="NoncurrentHeadVersions",
            prefix=f"city/v{R.SCHEMA}/latest.json",
            noncurrent_version_expiration=Duration.days(3),
        )
        data = s3.Bucket(
            self, "Data", lifecycle_rules=[head_versions] if config.prod else None, **private
        )
        data.add_to_resource_policy(
            iam.PolicyStatement(
                sid="TicksWriteOnce",
                effect=iam.Effect.DENY,
                principals=[iam.AnyPrincipal()],
                actions=["s3:PutObject"],
                resources=[data.arn_for_objects("city/*/ticks/*")],
                conditions={"Null": {"s3:if-none-match": "true"}},
            )
        )
        s3.Bucket(self, "Releases", **private)  # the archive deployment is S2

        log_group = logs.LogGroup(
            self, "TickLogs", retention=logs.RetentionDays.ONE_MONTH, removal_policy=removal
        )
        role = iam.Role(
            self,
            "TickRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            inline_policies={
                "Tick": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=["s3:GetObject", "s3:PutObject"],
                            resources=[data.arn_for_objects("city/*")],
                        ),
                        iam.PolicyStatement(
                            actions=["s3:ListBucket"],
                            resources=[data.bucket_arn],
                            conditions={"StringEquals": {"s3:prefix": "city/"}},
                        ),
                        iam.PolicyStatement(
                            actions=["logs:CreateLogStream", "logs:PutLogEvents"],
                            resources=[log_group.log_group_arn],
                        ),
                    ]
                )
            },
        )
        tick = lambda_.Function(
            self,
            "Tick",
            runtime=lambda_.Runtime.PYTHON_3_13,
            architecture=lambda_.Architecture.ARM_64,
            handler=HANDLER,
            code=lambda_.Code.from_asset(code_dir()),
            memory_size=256,
            timeout=Duration.seconds(60),
            retry_attempts=0,
            max_event_age=Duration.seconds(300),
            reserved_concurrent_executions=1 if config.reserved_concurrency else None,
            role=role,
            log_group=log_group,
            environment={
                "VEKTOR9_BUCKET": data.bucket_name,
                "VEKTOR9_SEED": str(config.seed),
                "VEKTOR9_GENESIS": config.genesis,
                "VEKTOR9_STAGE": config.stage,
            },
        )

        scheduler_role = iam.Role(
            self,
            "SchedulerRole",
            assumed_by=iam.ServicePrincipal(
                "scheduler.amazonaws.com",
                conditions={"StringEquals": {"aws:SourceAccount": self.account}},
            ),
        )
        scheduler.Schedule(
            self,
            "Every5Minutes",
            schedule=scheduler.ScheduleExpression.cron(minute="0/5", time_zone=TimeZone.ETC_UTC),
            target=targets.LambdaInvoke(
                tick,
                role=scheduler_role,
                retry_attempts=2,
                max_event_age=Duration.seconds(300),
                input=scheduler.ScheduleTargetInput.from_object(
                    {
                        "scheduled_time": scheduler.ContextAttribute.scheduled_time,
                        "execution_id": scheduler.ContextAttribute.execution_id,
                        "attempt": scheduler.ContextAttribute.attempt_number,
                    }
                ),
            ),
        )

        topic = sns.Topic(self, "Alerts")
        # a fixed ID: EmailSubscription would put the address in the logical ID
        sns.Subscription(
            self,
            "AlertEmail",
            topic=topic,
            protocol=sns.SubscriptionProtocol.EMAIL,
            endpoint=config.alert_email,
        )
        alert = cw_actions.SnsAction(topic)
        five = Duration.minutes(5)
        stalled = cw.Alarm(
            self,
            "CityStalled",
            alarm_description="No tick published for 15 minutes.",
            metric=cw.Metric(
                namespace=T.METRIC_NAMESPACE,
                metric_name=T.TICKS_PUBLISHED,
                dimensions_map={T.METRIC_DIMENSION: config.stage},
                statistic="Sum",
                period=five,
            ),
            comparison_operator=cw.ComparisonOperator.LESS_THAN_THRESHOLD,
            threshold=1,
            evaluation_periods=3,
            datapoints_to_alarm=3,
            treat_missing_data=cw.TreatMissingData.BREACHING,
        )
        errors = cw.Alarm(
            self,
            "TickErrors",
            alarm_description="The tick function failed in 2 of the last 3 slots.",
            metric=tick.metric_errors(statistic="Sum", period=five),
            comparison_operator=cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            threshold=1,
            evaluation_periods=3,
            datapoints_to_alarm=2,
            treat_missing_data=cw.TreatMissingData.NOT_BREACHING,
        )
        for alarm in (stalled, errors):
            alarm.add_alarm_action(alert)
