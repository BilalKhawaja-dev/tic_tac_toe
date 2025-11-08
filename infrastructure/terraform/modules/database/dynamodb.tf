# DynamoDB Tables for Game State Management

# Games table for real-time game state
resource "aws_dynamodb_table" "games" {
  name           = "${var.project_name}-games"
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.games_table_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.games_table_write_capacity : null
  hash_key       = "gameId"
  range_key      = "timestamp"

  attribute {
    name = "gameId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "playerId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "N"
  }

  # Global Secondary Index for player game history
  global_secondary_index {
    name            = "PlayerGameHistoryIndex"
    hash_key        = "playerId"
    range_key       = "createdAt"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_write_capacity : null
  }

  # Global Secondary Index for game status queries
  global_secondary_index {
    name            = "GameStatusIndex"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "KEYS_ONLY"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_write_capacity : null
  }

  # TTL for automatic cleanup of old games
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.dynamodb_kms_key_arn
  }

  # Stream for real-time updates
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = merge(var.tags, {
    Name = "${var.project_name}-games"
    Type = "game-state"
  })
}

# Game moves table for detailed move history
resource "aws_dynamodb_table" "game_moves" {
  name           = "${var.project_name}-game-moves"
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.moves_table_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.moves_table_write_capacity : null
  hash_key       = "gameId"
  range_key      = "moveNumber"

  attribute {
    name = "gameId"
    type = "S"
  }

  attribute {
    name = "moveNumber"
    type = "N"
  }

  attribute {
    name = "playerId"
    type = "S"
  }

  # Global Secondary Index for player moves
  global_secondary_index {
    name            = "PlayerMovesIndex"
    hash_key        = "playerId"
    range_key       = "moveNumber"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_write_capacity : null
  }

  # TTL for automatic cleanup
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.dynamodb_kms_key_arn
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-game-moves"
    Type = "game-moves"
  })
}

# Leaderboard table for rankings
resource "aws_dynamodb_table" "leaderboard" {
  name           = "${var.project_name}-leaderboard"
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.leaderboard_table_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.leaderboard_table_write_capacity : null
  hash_key       = "leaderboardType"
  range_key      = "score"

  attribute {
    name = "leaderboardType"
    type = "S"
  }

  attribute {
    name = "score"
    type = "N"
  }

  attribute {
    name = "playerId"
    type = "S"
  }

  attribute {
    name = "region"
    type = "S"
  }

  # Global Secondary Index for player leaderboard position
  global_secondary_index {
    name            = "PlayerLeaderboardIndex"
    hash_key        = "playerId"
    range_key       = "leaderboardType"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_write_capacity : null
  }

  # Global Secondary Index for regional leaderboards
  global_secondary_index {
    name            = "RegionalLeaderboardIndex"
    hash_key        = "region"
    range_key       = "score"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_write_capacity : null
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.dynamodb_kms_key_arn
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-leaderboard"
    Type = "leaderboard"
  })
}

# User sessions table for active session management
resource "aws_dynamodb_table" "user_sessions" {
  name           = "${var.project_name}-user-sessions"
  billing_mode   = var.dynamodb_billing_mode
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.sessions_table_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.sessions_table_write_capacity : null
  hash_key       = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  # Global Secondary Index for user sessions
  global_secondary_index {
    name            = "UserSessionsIndex"
    hash_key        = "userId"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_read_capacity : null
    write_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.gsi_write_capacity : null
  }

  # TTL for automatic session cleanup
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.dynamodb_kms_key_arn
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-user-sessions"
    Type = "user-sessions"
  })
}

# Global Tables for multi-region replication
resource "aws_dynamodb_global_table" "games_global" {
  count = var.enable_global_tables ? 1 : 0
  name  = aws_dynamodb_table.games.name

  replica {
    region_name = data.aws_region.current.name
  }

  replica {
    region_name = var.secondary_region
  }

  depends_on = [aws_dynamodb_table.games]
}

resource "aws_dynamodb_global_table" "game_moves_global" {
  count = var.enable_global_tables ? 1 : 0
  name  = aws_dynamodb_table.game_moves.name

  replica {
    region_name = data.aws_region.current.name
  }

  replica {
    region_name = var.secondary_region
  }

  depends_on = [aws_dynamodb_table.game_moves]
}

resource "aws_dynamodb_global_table" "leaderboard_global" {
  count = var.enable_global_tables ? 1 : 0
  name  = aws_dynamodb_table.leaderboard.name

  replica {
    region_name = data.aws_region.current.name
  }

  replica {
    region_name = var.secondary_region
  }

  depends_on = [aws_dynamodb_table.leaderboard]
}

resource "aws_dynamodb_global_table" "user_sessions_global" {
  count = var.enable_global_tables ? 1 : 0
  name  = aws_dynamodb_table.user_sessions.name

  replica {
    region_name = data.aws_region.current.name
  }

  replica {
    region_name = var.secondary_region
  }

  depends_on = [aws_dynamodb_table.user_sessions]
}

# Auto Scaling for DynamoDB tables (if using provisioned billing)
resource "aws_appautoscaling_target" "games_read_target" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_autoscaling ? 1 : 0
  max_capacity       = var.games_table_max_read_capacity
  min_capacity       = var.games_table_read_capacity
  resource_id        = "table/${aws_dynamodb_table.games.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "games_read_policy" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_autoscaling ? 1 : 0
  name               = "${var.project_name}-games-read-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.games_read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.games_read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.games_read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_target" "games_write_target" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_autoscaling ? 1 : 0
  max_capacity       = var.games_table_max_write_capacity
  min_capacity       = var.games_table_write_capacity
  resource_id        = "table/${aws_dynamodb_table.games.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "games_write_policy" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" && var.enable_autoscaling ? 1 : 0
  name               = "${var.project_name}-games-write-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.games_write_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.games_write_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.games_write_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = 70.0
  }
}

# CloudWatch Alarms for DynamoDB
resource "aws_cloudwatch_metric_alarm" "games_read_throttle" {
  alarm_name          = "${var.project_name}-games-read-throttle"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadThrottledEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB read throttling"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    TableName = aws_dynamodb_table.games.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "games_write_throttle" {
  alarm_name          = "${var.project_name}-games-write-throttle"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteThrottledEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DynamoDB write throttling"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    TableName = aws_dynamodb_table.games.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "games_errors" {
  alarm_name          = "${var.project_name}-games-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors DynamoDB system errors"
  alarm_actions       = [var.critical_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    TableName = aws_dynamodb_table.games.name
  }

  tags = var.tags
}