// Setup the Lambda function
resource "aws_iam_role" "forwarder_function" {
  name = "ses-forwarder-function-role"

  assume_role_policy = jsonencode(
    {
      "Version" : "2012-10-17",
      "Statement" : [
        {
          "Action" : "sts:AssumeRole",
          "Principal" : {
            "Service" : "lambda.amazonaws.com"
          },
          "Effect" : "Allow",
          "Sid" : ""
        }
      ]
    }
  )
}
resource "aws_lambda_function" "forwarder" {
  function_name = "ses-forwarder-function"

  filename         = "function.zip"
  source_code_hash = filebase64sha256("function.zip")

  role    = aws_iam_role.forwarder_function.arn
  runtime = "nodejs12.x"
  handler = "index.handler"
}

// Setup Lambda function logging
resource "aws_cloudwatch_log_group" "forwarder_function" {
  name = "/aws/lambda/${aws_lambda_function.forwarder.function_name}"
}
resource "aws_iam_policy" "forwarder_function_logs" {
  name = "ses-forwarder-function-logging-policy"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Action" : [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource" : "${aws_cloudwatch_log_group.forwarder_function.arn}:*",
        "Effect" : "Allow"
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "forwarder_function_logging" {
  role       = aws_iam_role.forwarder_function.name
  policy_arn = aws_iam_policy.forwarder_function_logs.arn
}
