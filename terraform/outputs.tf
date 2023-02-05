output "email_bucket_name" {
  description = "Email bucket name"
  value       = aws_s3_bucket.email.id
}
