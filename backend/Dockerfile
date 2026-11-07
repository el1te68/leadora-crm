# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Leadora.slnx ./
COPY src/Leadora.Domain/Leadora.Domain.csproj src/Leadora.Domain/
COPY src/Leadora.Application/Leadora.Application.csproj src/Leadora.Application/
COPY src/Leadora.Infrastructure/Leadora.Infrastructure.csproj src/Leadora.Infrastructure/
COPY src/Leadora.Api/Leadora.Api.csproj src/Leadora.Api/
RUN dotnet restore src/Leadora.Api/Leadora.Api.csproj
COPY src/ src/
RUN dotnet publish src/Leadora.Api/Leadora.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    TZ=Asia/Tehran
COPY --from=build /app/publish .
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=6 CMD curl -fs http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "Leadora.Api.dll"]
