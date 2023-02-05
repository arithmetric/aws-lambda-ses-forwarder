data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "email" {
  bucket = "${var.domain}-aws-lambda-ses-forwarder-bucket"

  # Might have to uncomment this to be able to destroy the bucket
  # force_destroy = true
}

resource "aws_s3_bucket_acl" "email" {
  bucket = aws_s3_bucket.email.id
  acl    = "private"
}

resource "aws_s3_bucket_public_access_block" "email" {
  bucket = aws_s3_bucket.email.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

// Allow SES to put emails
resource "aws_s3_bucket_policy" "email" {
  bucket = aws_s3_bucket.email.id

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Sid" : "AllowSESPuts",
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "ses.amazonaws.com"
        },
        "Action" : "s3:PutObject",
        "Resource" : "${aws_s3_bucket.email.arn}/*",
        "Condition" : {
          "StringEquals" : {
            "AWS:SourceAccount" : "${data.aws_caller_identity.current.account_id}",
            "AWS:SourceArn" : "arn:aws:ses:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:receipt-rule-set/${data.aws_ses_active_receipt_rule_set.main.rule_set_name}:receipt-rule/${local.aws_ses_receipt_rule_name}"
            #"AWS:SourceArn" : "${aws_ses_receipt_rule.store.arn}" # Can't use because of dependencies
          }
        }
      }
    ]
  })
}

// Allow Lambda to put and get emails
resource "aws_iam_policy" "forwarder_function_bucket" {
  name = "ses-forwarder-function-bucket-policy"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "s3:GetObject",
          "s3:PutObject"
        ],
        "Resource" : "${aws_s3_bucket.email.arn}/*"
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "forwarder_function_bucket" {
  role       = aws_iam_role.forwarder_function.name
  policy_arn = aws_iam_policy.forwarder_function_bucket.arn
}
