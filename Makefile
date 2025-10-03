TAG=$(shell date "+%Y%m%d%H%M%S")
production:
	pnpm install
	pnpm build
	docker buildx build --load --platform=linux/amd64 -t mcp-server .
	docker tag mcp-server:latest 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:main
	docker tag mcp-server:latest 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:$(TAG)
	docker push 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:main
	docker push 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:$(TAG)
	kubectl --namespace things5-production set image deployment/mcp-server mcp-server=974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:$(TAG)
staging:
	pnpm install
	pnpm build
	docker buildx build --load --platform=linux/amd64 -t mcp-server .
	docker tag mcp-server:latest 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:staging
	docker tag mcp-server:latest 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:$(TAG)
	docker push 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:staging
	docker push 974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:$(TAG)
	kubectl --namespace things5-staging set image deployment/mcp-server mcp-server=974479612954.dkr.ecr.eu-west-1.amazonaws.com/things5/mcp-server:$(TAG)