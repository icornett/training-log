# syntax=docker/dockerfile:1
FROM ruby:4.0.4-slim-trixie AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tzdata && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install gems
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' && \
    bundle config set --local deployment true && \
    bundle install --jobs 4 --retry 3

# Copy application source
COPY . .

FROM ruby:4.0.4-slim-trixie AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    tzdata && \
    rm -rf /var/lib/apt/lists/*

RUN rm -f /usr/local/lib/ruby/gems/4.0.0/specifications/default/json-2.18.0.gemspec && \
    rm -f /usr/local/lib/ruby/gems/4.0.0/specifications/net-imap-0.6.2.gemspec

WORKDIR /app

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /app /app

EXPOSE 4567

# Run as non-root
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser

CMD ["bundle", "exec", "ruby", "workouts.rb", "-o", "0.0.0.0", "-p", "4567"]
