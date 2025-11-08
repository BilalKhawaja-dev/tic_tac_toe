# API Gateway Service Integrations
# Routes requests to backend microservices

# ============================================================================
# Authentication Service Integration
# ============================================================================

# Auth service resource
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "auth"
}

# Auth service proxy resource
resource "aws_api_gateway_resource" "auth_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "{proxy+}"
}

# Auth service methods
resource "aws_api_gateway_method" "auth_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth_proxy.id
  http_method   = "ANY"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# Auth service integration
resource "aws_api_gateway_integration" "auth_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.auth_proxy.id
  http_method = aws_api_gateway_method.auth_proxy.http_method

  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "${var.auth_service_url}/{proxy}"

  request_parameters = {
    "integration.request.path.proxy" = "method.request.path.proxy"
  }

  timeout_milliseconds = 29000
}

# ============================================================================
# Game Engine Service Integration
# ============================================================================

# Game service resource
resource "aws_api_gateway_resource" "game" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "game"
}

# Game service proxy resource
resource "aws_api_gateway_resource" "game_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.game.id
  path_part   = "{proxy+}"
}

# Game service methods (requires authentication)
resource "aws_api_gateway_method" "game_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.game_proxy.id
  http_method   = "ANY"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.lambda.id

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# Game service integration
resource "aws_api_gateway_integration" "game_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.game_proxy.id
  http_method = aws_api_gateway_method.game_proxy.http_method

  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "${var.game_engine_url}/{proxy}"

  request_parameters = {
    "integration.request.path.proxy"           = "method.request.path.proxy"
    "integration.request.header.X-User-Id"     = "context.authorizer.userId"
    "integration.request.header.X-Auth-Type"   = "context.authorizer.authType"
  }

  timeout_milliseconds = 29000
}

# ============================================================================
# Leaderboard Service Integration
# ============================================================================

# Leaderboard service resource
resource "aws_api_gateway_resource" "leaderboard" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "leaderboard"
}

# Leaderboard service proxy resource
resource "aws_api_gateway_resource" "leaderboard_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.leaderboard.id
  path_part   = "{proxy+}"
}

# Leaderboard service methods (optional authentication)
resource "aws_api_gateway_method" "leaderboard_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.leaderboard_proxy.id
  http_method   = "ANY"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.lambda.id

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# Leaderboard service integration
resource "aws_api_gateway_integration" "leaderboard_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.leaderboard_proxy.id
  http_method = aws_api_gateway_method.leaderboard_proxy.http_method

  integration_http_method = "ANY"
  type                    = "HTTP_PROXY"
  uri                     = "${var.leaderboard_service_url}/{proxy}"

  request_parameters = {
    "integration.request.path.proxy"         = "method.request.path.proxy"
    "integration.request.header.X-User-Id"   = "context.authorizer.userId"
    "integration.request.header.X-Auth-Type" = "context.authorizer.authType"
  }

  timeout_milliseconds = 29000
}

# ============================================================================
# Support Service Integration (Lambda)
# ============================================================================

# Support service resource
resource "aws_api_gateway_resource" "support" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "support"
}

# Support service proxy resource
resource "aws_api_gateway_resource" "support_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.support.id
  path_part   = "{proxy+}"
}

# Support service methods
resource "aws_api_gateway_method" "support_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.support_proxy.id
  http_method   = "ANY"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.lambda.id

  request_parameters = {
    "method.request.path.proxy" = true
  }
}

# Support service integration (Lambda proxy)
resource "aws_api_gateway_integration" "support_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.support_proxy.id
  http_method = aws_api_gateway_method.support_proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.support_service_url

  timeout_milliseconds = 29000
}

# ============================================================================
# WebSocket API for Game Engine
# ============================================================================

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project_name}-websocket-${var.environment}"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = {
    Name        = "${var.project_name}-websocket-${var.environment}"
    Environment = var.environment
  }
}

# WebSocket routes
resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_connect.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_disconnect.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_default.id}"
}

# WebSocket integrations
resource "aws_apigatewayv2_integration" "websocket_connect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "${var.game_engine_url}/ws/connect"
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "websocket_disconnect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "${var.game_engine_url}/ws/disconnect"
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "websocket_default" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "${var.game_engine_url}/ws/message"
  integration_method = "POST"
}

# WebSocket stage
resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.api_rate_limit
    throttling_burst_limit = var.api_burst_limit
  }

  tags = {
    Name        = "${var.project_name}-websocket-stage-${var.environment}"
    Environment = var.environment
  }
}
