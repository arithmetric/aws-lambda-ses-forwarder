# TODO: check allow_overwrite

data "aws_region" "current" {}

data "aws_route53_zone" "domain" {
  name = var.domain
}

resource "aws_ses_domain_identity" "domain" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "domain" {
  domain = aws_ses_domain_identity.domain.domain
}

resource "aws_ses_domain_mail_from" "domain" {
  domain           = aws_ses_domain_identity.domain.domain
  mail_from_domain = "bounce.${aws_ses_domain_identity.domain.domain}"
}

resource "aws_route53_record" "domain_dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.domain.id
  name    = "${aws_ses_domain_dkim.domain.dkim_tokens[count.index]}._domainkey.${aws_ses_domain_identity.domain.domain}"
  type    = "CNAME"
  ttl     = "600"
  records = ["${aws_ses_domain_dkim.domain.dkim_tokens[count.index]}.dkim.amazonses.com"]

  allow_overwrite = true
}

resource "aws_route53_record" "domain_from_mx" {
  zone_id = data.aws_route53_zone.domain.id
  name    = aws_ses_domain_mail_from.domain.mail_from_domain
  type    = "MX"
  ttl     = "600"
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]

  allow_overwrite = true
}

resource "aws_route53_record" "domain_from_txt" {
  zone_id = data.aws_route53_zone.domain.id
  name    = aws_ses_domain_mail_from.domain.mail_from_domain
  type    = "TXT"
  ttl     = "600"
  records = ["v=spf1 include:amazonses.com -all"]

  allow_overwrite = true
}

# Email receiving https://docs.aws.amazon.com/ses/latest/dg/receiving-email-mx-record.html
resource "aws_route53_record" "domain_receiving" {
  zone_id = data.aws_route53_zone.domain.id
  name    = aws_ses_domain_identity.domain.domain
  type    = "MX"
  ttl     = "600"
  records = ["10 inbound-smtp.${data.aws_region.current.name}.amazonaws.com"]

  allow_overwrite = true
}

// Allow Lambda to send emails
resource "aws_iam_policy" "forwarder_function_send_email" {
  name = "ses-forwarder-function-send-email-policy"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : "ses:SendRawEmail",
        "Resource" : "*" # TODO: Is this secure?
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "forwarder_function_send_email" {
  role       = aws_iam_role.forwarder_function.name
  policy_arn = aws_iam_policy.forwarder_function_send_email.arn
}


# Allow SES to invoke our Lambda forwarder function
resource "aws_lambda_permission" "ses_invoke" {
  statement_id  = "AllowSESInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.forwarder.function_name
  principal     = "ses.amazonaws.com"
  source_arn    = "arn:aws:ses:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:receipt-rule-set/${data.aws_ses_active_receipt_rule_set.main.rule_set_name}:receipt-rule/${local.aws_ses_receipt_rule_name}" # TODO: FIX
}

data "aws_ses_active_receipt_rule_set" "main" {}

resource "aws_ses_receipt_rule" "store" {
  depends_on = [
    aws_s3_bucket_policy.email,
    aws_lambda_permission.ses_invoke
  ]

  name          = local.aws_ses_receipt_rule_name
  rule_set_name = data.aws_ses_active_receipt_rule_set.main.rule_set_name

  enabled      = true
  recipients   = [var.domain]
  scan_enabled = true

  s3_action {
    bucket_name = aws_s3_bucket.email.id
    position    = 1
  }

  lambda_action {
    function_arn = aws_lambda_function.forwarder.arn
    position     = 2
  }
}
