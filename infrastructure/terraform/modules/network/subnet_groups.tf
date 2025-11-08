# Subnet Groups for AWS Services

# RDS Subnet Group (using isolated subnets for maximum security)
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.isolated[*].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-db-subnet-group"
    Type = "database"
  })
}

# ElastiCache Subnet Group (using private subnets)
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-cache-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-cache-subnet-group"
    Type = "cache"
  })
}

# DAX Subnet Group (using private subnets)
resource "aws_dax_subnet_group" "main" {
  name       = "${var.project_name}-dax-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

# EFS Mount Targets (one per AZ in private subnets)
resource "aws_efs_mount_target" "main" {
  # Only create if EFS file system ID is provided
  count = var.efs_file_system_id != "" ? length(aws_subnet.private) : 0

  file_system_id  = var.efs_file_system_id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

# EFS Security Group
resource "aws_security_group" "efs" {
  name_prefix = "${var.project_name}-efs-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for EFS"

  ingress {
    description     = "NFS from ECS"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  ingress {
    description     = "NFS from Lambda"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-efs-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}