"""Template tests for the core stack (ADR-0017), both stages, with dummy context values.
Skipped unless the infra and lambda dependency groups are installed."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip("aws_cdk")

from aws_cdk import App  # noqa: E402
from aws_cdk.assertions import Template  # noqa: E402

from infra import package, stack  # noqa: E402
from infra.app import build  # noqa: E402
from lambdas import tick  # noqa: E402
from sim import rules  # noqa: E402

GENESIS = "2026-12-01T00:00:00Z"
EMAIL = "alerts@example.com"
FORBIDDEN = ("AWS::EC2::", "AWS::RDS::", "AWS::ElasticLoadBalancing")


def context(stage, **extra):
    return {f"{stage}.seed": "7", f"{stage}.genesis": GENESIS, f"{stage}.alert_email": EMAIL} | {
        f"{stage}.{k}": v for k, v in extra.items()
    }


def synth(stage, **extra):
    app = build(App(context=context(stage, **extra)))
    return Template.from_stack(app.node.find_child(f"Vektor9-{stage}")).to_json()


@pytest.fixture(scope="module")
def templates():
    return {s: synth(s) for s in stack.STAGES}


def of_type(t, kind):
    return {k: r for k, r in t["Resources"].items() if r["Type"] == kind}


def one(t, kind):
    (r,) = of_type(t, kind).values()
    return r["Properties"]


def ref(logical_id):
    return {"Fn::GetAtt": [logical_id, "Arn"]}


def logical(t, kind, prefix):
    (k,) = [k for k in of_type(t, kind) if k.startswith(prefix)]
    return k


def statements(t):
    """Every IAM statement in the template: role policies, managed and bucket policies."""
    for r in t["Resources"].values():
        p = r.get("Properties", {})
        for doc in [x["PolicyDocument"] for x in p.get("Policies", [])] + [p.get("PolicyDocument")]:
            yield from (doc or {}).get("Statement", [])


def as_list(x):
    return x if isinstance(x, list) else [x]


@pytest.mark.parametrize("stage", stack.STAGES)
def test_log_groups_have_retention_and_every_function_an_explicit_group(templates, stage):
    t = templates[stage]
    groups = of_type(t, "AWS::Logs::LogGroup")
    assert groups and all("RetentionInDays" in g["Properties"] for g in groups.values())
    for fn in of_type(t, "AWS::Lambda::Function").values():
        assert fn["Properties"]["LoggingConfig"]["LogGroup"]["Ref"] in groups


@pytest.mark.parametrize("stage", stack.STAGES)
def test_no_vpc_and_no_forbidden_resource_types(templates, stage):
    t = templates[stage]
    assert not [k for k, r in t["Resources"].items() if r["Type"].startswith(FORBIDDEN)]
    for fn in of_type(t, "AWS::Lambda::Function").values():
        assert "VpcConfig" not in fn["Properties"]


@pytest.mark.parametrize("stage", stack.STAGES)
def test_tick_role_exact_permissions(templates, stage):
    t = templates[stage]
    data, logs = logical(t, "AWS::S3::Bucket", "Data"), logical(t, "AWS::Logs::LogGroup", "Tick")
    role = of_type(t, "AWS::IAM::Role")[logical(t, "AWS::IAM::Role", "TickRole")]["Properties"]
    assert "ManagedPolicyArns" not in role
    (policy,) = role["Policies"]
    assert policy["PolicyDocument"]["Statement"] == [
        {
            "Action": ["s3:GetObject", "s3:PutObject"],
            "Effect": "Allow",
            "Resource": {"Fn::Join": ["", [ref(data), "/city/*"]]},
        },
        {
            "Action": "s3:ListBucket",
            "Condition": {"StringEquals": {"s3:prefix": "city/"}},
            "Effect": "Allow",
            "Resource": ref(data),
        },
        {
            "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
            "Effect": "Allow",
            "Resource": ref(logs),
        },
    ]
    # no other policy attaches to the tick role
    for p in of_type(t, "AWS::IAM::Policy").values():
        assert {"Ref": logical(t, "AWS::IAM::Role", "TickRole")} not in p["Properties"]["Roles"]


@pytest.mark.parametrize("stage", stack.STAGES)
def test_no_wildcard_actions_in_allow_statements(templates, stage):
    allows = [s for s in statements(templates[stage]) if s["Effect"] == "Allow"]
    assert allows
    for s in allows:
        assert not [a for a in as_list(s["Action"]) if "*" in a], s


@pytest.mark.parametrize("stage", stack.STAGES)
def test_schedule(templates, stage):
    s = one(templates[stage], "AWS::Scheduler::Schedule")
    assert s["ScheduleExpression"] == "cron(0/5 * * * ? *)"
    assert s["ScheduleExpressionTimezone"] == "Etc/UTC"
    assert s["FlexibleTimeWindow"] == {"Mode": "OFF"}
    assert s["State"] == "ENABLED"
    target = s["Target"]
    assert target["Arn"] == ref(logical(templates[stage], "AWS::Lambda::Function", "Tick"))
    assert target["RetryPolicy"] == {"MaximumRetryAttempts": 2, "MaximumEventAgeInSeconds": 300}
    assert "DeadLetterConfig" not in target
    assert json.loads(target["Input"]) == {
        "scheduled_time": "<aws.scheduler.scheduled-time>",
        "execution_id": "<aws.scheduler.execution-id>",
        "attempt": "<aws.scheduler.attempt-number>",
    }


@pytest.mark.parametrize("stage", stack.STAGES)
def test_scheduler_role_trust_and_invoke_only_the_tick(templates, stage):
    t = templates[stage]
    role_id = logical(t, "AWS::IAM::Role", "SchedulerRole")
    role = of_type(t, "AWS::IAM::Role")[role_id]["Properties"]
    assert role["AssumeRolePolicyDocument"]["Statement"] == [
        {
            "Action": "sts:AssumeRole",
            "Condition": {"StringEquals": {"aws:SourceAccount": {"Ref": "AWS::AccountId"}}},
            "Effect": "Allow",
            "Principal": {"Service": "scheduler.amazonaws.com"},
        }
    ]
    assert one(t, "AWS::Scheduler::Schedule")["Target"]["RoleArn"] == ref(role_id)
    (policy,) = [
        p["Properties"]
        for p in of_type(t, "AWS::IAM::Policy").values()
        if p["Properties"]["Roles"] == [{"Ref": role_id}]
    ]
    fn = ref(logical(t, "AWS::Lambda::Function", "Tick"))
    # the function and its own qualified ARNs (versions, aliases): CDK's grantInvoke
    assert policy["PolicyDocument"]["Statement"] == [
        {
            "Action": "lambda:InvokeFunction",
            "Effect": "Allow",
            "Resource": [fn, {"Fn::Join": ["", [fn, ":*"]]}],
        }
    ]


@pytest.mark.parametrize("stage", stack.STAGES)
def test_function_settings(templates, stage):
    t = templates[stage]
    fn = one(t, "AWS::Lambda::Function")
    assert fn["Runtime"] == "python3.13"
    assert fn["Architectures"] == ["arm64"]
    assert (fn["MemorySize"], fn["Timeout"]) == (256, 60)
    assert fn["Handler"] == "lambdas.tick.handler"
    assert fn["Environment"]["Variables"] == {
        "VEKTOR9_BUCKET": {"Ref": logical(t, "AWS::S3::Bucket", "Data")},
        "VEKTOR9_SEED": "7",
        "VEKTOR9_GENESIS": GENESIS,
        "VEKTOR9_STAGE": stage,
    }
    assert "ReservedConcurrentExecutions" not in fn  # off by default
    invoke = one(t, "AWS::Lambda::EventInvokeConfig")
    assert (invoke["MaximumRetryAttempts"], invoke["MaximumEventAgeInSeconds"]) == (0, 300)


def test_reserved_concurrency_when_switched_on():
    fn = one(synth("dev", reserved_concurrency="true"), "AWS::Lambda::Function")
    assert fn["ReservedConcurrentExecutions"] == 1


@pytest.mark.parametrize("stage", stack.STAGES)
def test_buckets_private_encrypted_tls_only(templates, stage):
    t = templates[stage]
    buckets = of_type(t, "AWS::S3::Bucket")
    assert sorted(k.rstrip("0123456789ABCDEF") for k in buckets) == ["Data", "Releases"]
    for k, b in buckets.items():
        p = b["Properties"]
        assert "BucketName" not in p
        assert all(p["PublicAccessBlockConfiguration"].values())
        assert p["BucketEncryption"]["ServerSideEncryptionConfiguration"] == [
            {"ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}
        ]
        (policy,) = [
            x["Properties"]["PolicyDocument"]["Statement"]
            for x in of_type(t, "AWS::S3::BucketPolicy").values()
            if x["Properties"]["Bucket"] == {"Ref": k}
        ]
        assert {
            "Action": "s3:*",
            "Condition": {"Bool": {"aws:SecureTransport": "false"}},
            "Effect": "Deny",
            "Principal": {"AWS": "*"},
            "Resource": [ref(k), {"Fn::Join": ["", [ref(k), "/*"]]}],
        } in policy


@pytest.mark.parametrize("stage", stack.STAGES)
def test_tick_puts_denied_without_if_none_match(templates, stage):
    t = templates[stage]
    data = logical(t, "AWS::S3::Bucket", "Data")
    (policy,) = [
        x["Properties"]["PolicyDocument"]["Statement"]
        for x in of_type(t, "AWS::S3::BucketPolicy").values()
        if x["Properties"]["Bucket"] == {"Ref": data}
    ]
    assert {
        "Sid": "TicksWriteOnce",
        "Action": "s3:PutObject",
        "Condition": {"Null": {"s3:if-none-match": "true"}},
        "Effect": "Deny",
        "Principal": {"AWS": "*"},
        "Resource": {"Fn::Join": ["", [ref(data), "/city/*/ticks/*"]]},
    } in policy


def test_prod_versioned_retained_and_only_old_heads_expire(templates):
    t = templates["prod"]
    for b in of_type(t, "AWS::S3::Bucket").values():
        assert b["Properties"]["VersioningConfiguration"] == {"Status": "Enabled"}
        assert (b["DeletionPolicy"], b["UpdateReplacePolicy"]) == ("Retain", "Retain")
    data = of_type(t, "AWS::S3::Bucket")[logical(t, "AWS::S3::Bucket", "Data")]["Properties"]
    assert data["LifecycleConfiguration"]["Rules"] == [
        {
            "Id": "NoncurrentHeadVersions",
            "Prefix": f"city/v{stack.R.SCHEMA}/latest.json",
            "NoncurrentVersionExpiration": {"NoncurrentDays": 3},
            "Status": "Enabled",
        }
    ]
    releases = of_type(t, "AWS::S3::Bucket")[logical(t, "AWS::S3::Bucket", "Releases")]
    assert "LifecycleConfiguration" not in releases["Properties"]


def test_head_lifecycle_prefix_follows_the_schema(templates):
    t = templates["prod"]
    data = of_type(t, "AWS::S3::Bucket")[logical(t, "AWS::S3::Bucket", "Data")]["Properties"]
    (rule,) = data["LifecycleConfiguration"]["Rules"]
    assert rule["Prefix"] == f"city/v{rules.SCHEMA}/latest.json"


def test_dev_unversioned_destroyed_without_auto_delete(templates):
    t = templates["dev"]
    for b in of_type(t, "AWS::S3::Bucket").values():
        assert "VersioningConfiguration" not in b["Properties"]
        assert "LifecycleConfiguration" not in b["Properties"]
        assert b["DeletionPolicy"] == "Delete"
    assert not [r for r in t["Resources"].values() if "AutoDelete" in r["Type"]]
    assert len(of_type(t, "AWS::Lambda::Function")) == 1


@pytest.mark.parametrize("stage", stack.STAGES)
def test_alarms_follow_the_handler_and_notify_the_topic(templates, stage):
    t = templates[stage]
    namespace, dimension = tick.METRIC_NAMESPACE, tick.METRIC_DIMENSION
    alarms = of_type(t, "AWS::CloudWatch::Alarm")
    assert len(alarms) == 2
    stalled = alarms[logical(t, "AWS::CloudWatch::Alarm", "CityStalled")]["Properties"]
    errors = alarms[logical(t, "AWS::CloudWatch::Alarm", "TickErrors")]["Properties"]
    assert (stalled["Namespace"], stalled["MetricName"]) == (namespace, tick.TICKS_PUBLISHED)
    assert stalled["Dimensions"] == [{"Name": dimension, "Value": stage}]
    assert (stalled["Statistic"], stalled["Period"], stalled["Threshold"]) == ("Sum", 300, 1)
    assert stalled["ComparisonOperator"] == "LessThanThreshold"
    assert (stalled["EvaluationPeriods"], stalled["DatapointsToAlarm"]) == (3, 3)
    assert stalled["TreatMissingData"] == "breaching"
    assert (errors["Namespace"], errors["MetricName"]) == ("AWS/Lambda", "Errors")
    fn = {"Ref": logical(t, "AWS::Lambda::Function", "Tick")}
    assert errors["Dimensions"] == [{"Name": "FunctionName", "Value": fn}]
    assert (errors["Statistic"], errors["Period"], errors["Threshold"]) == ("Sum", 300, 1)
    assert errors["ComparisonOperator"] == "GreaterThanOrEqualToThreshold"
    assert (errors["EvaluationPeriods"], errors["DatapointsToAlarm"]) == (3, 2)
    assert errors["TreatMissingData"] == "notBreaching"
    topic = {"Ref": logical(t, "AWS::SNS::Topic", "Alerts")}
    assert stalled["AlarmActions"] == errors["AlarmActions"] == [topic]
    sub = one(t, "AWS::SNS::Subscription")
    assert (sub["Protocol"], sub["Endpoint"], sub["TopicArn"]) == ("email", EMAIL, topic)
    assert not [k for k in t["Resources"] if "example" in k.lower()]  # no address in an ID


def test_synth_is_deterministic(templates):
    stack.code_dir.cache_clear()  # stage the package again into a new directory
    again = synth("dev")
    assert json.dumps(again, sort_keys=True) == json.dumps(templates["dev"], sort_keys=True)


def test_package_is_pure_python_without_bytecode_and_boto3_supports_conditional_puts():
    root = Path(stack.code_dir())
    files = [p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()]
    assert {"lambdas/__init__.py", "lambdas/tick.py", "sim/step.py"} <= set(files)
    assert not [f for f in files if f.endswith(".pyc") or "__pycache__" in f]
    assert {f.split("/")[0] for f in files} >= {"boto3", "botocore", "s3transfer", "urllib3"}
    # import the staged copy only (-S: no site-packages), as the runtime would load it
    probe = (
        "import sys; sys.path.insert(0, sys.argv[1]); import boto3, botocore; "
        "assert botocore.__file__.startswith(sys.argv[1]); "
        "c = boto3.client('s3', region_name='us-east-1'); "
        "m = c.meta.service_model.operation_model('PutObject').input_shape.members; "
        "print(boto3.__version__, 'IfMatch' in m and 'IfNoneMatch' in m)"
    )
    out = subprocess.run(
        [sys.executable, "-S", "-c", probe, str(root)], capture_output=True, text=True, check=True
    )
    assert out.stdout.split() == [dict(package.lambda_pins())["boto3"], "True"]


def test_stage_config_is_checked_at_synth():
    get = context("dev").get
    assert stack.stage_config("dev", get) == stack.StageConfig("dev", 7, GENESIS, EMAIL, False)
    with pytest.raises(ValueError, match="dev.alert_email"):
        stack.stage_config("dev", lambda k: None if k.endswith("email") else get(k))
    with pytest.raises(ValueError, match="5-minute boundary"):
        stack.stage_config("dev", lambda k: "2026-12-01T00:01:00Z" if "genesis" in k else get(k))
    with pytest.raises(ValueError, match="reserved_concurrency"):
        stack.stage_config("dev", lambda k: "yes" if "reserved" in k else get(k))
    with pytest.raises(ValueError, match="no stage context"):
        build(App())
