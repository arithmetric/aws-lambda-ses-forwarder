variable "domain" {
  description = "Domain name"
  type        = string
}

# This should be the name of the hosted zone, without subdomains
variable "base_domain" {
  description = "Domain base name"
  type        = string
}

# TODO:
# If the SES identity is already verified through Route53 records, Terraform might try
# to overwrite those records with the same ones and if this is not set to true, it 
# will cancel the deployment.
# Terraform should check if the records are already created instead.
variable "allow_route53_overwrite" {
  description = "Allow overwriting Route53 SES records"
  type        = bool
  default     = false
}

variable "email_key_prefix" {
  description = "Email key prefix"
  type        = string
  default     = ""
}
