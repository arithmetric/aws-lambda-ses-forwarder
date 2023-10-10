terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.53.0"
    }
  }

  # backend "s3" {
  #   bucket         = ""
  #   region         = ""
  #   dynamodb_table = ""
  #   encrypt        = true

  #   key = ""
  # }
}

provider "aws" {
  default_tags {
    tags = {
      Project   = "aws-lambda-ses-forwarder"
      ManagedBy = "terraform"
    }
  }
}

locals {
  aws_ses_receipt_rule_name = "${var.domain}-aws-lambda-ses-forwarder"
}
