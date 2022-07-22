# event-stream-processor

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/event-stream-processor.svg?style=flat)](https://github.com/mojaloop/event-stream-processor/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/event-stream-processor.svg?style=flat)](https://github.com/mojaloop/event-stream-processor/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/event-stream-processor.svg?style=flat)](https://hub.docker.com/r/mojaloop/event-stream-processor)
[![CircleCI](https://circleci.com/gh/mojaloop/event-stream-processor.svg?style=svg)](https://app.circleci.com/pipelines/github/mojaloop/event-stream-processor)

**EXPERIMENTAL** Event Stream Processor (ESP) for Event Stream (logs, audits, errors, trace, etc)

## TODO

- Improve unit tests.
- Improve code-coverage to 90% across the board: [.nycrc.yml](./.nycrc.yml).
- Add NPM script `test` as a `pre-commit` in the package.json.
- Update CI-CD to include unit and code-coverage checks.
- Technical Debt to be resolved:
  - Address legacy API changes that will be deprecated with RXJS v8.
  - Re-factor solution to not rely on forked implementations of `@mojaloop/elastic-apm-node*` dependencies. Consider something using [elastic-apm-http-client](https://www.npmjs.com/package/elastic-apm-http-client), or completely replace with [opentelemetry](https://opentelemetry.io/docs/instrumentation/js/getting-started/).
  - Re-factor solution to use [@elastic/elasticsearch](https://www.npmjs.com/package/@elastic/elasticsearch) instead of deprecated [elasticsearch](https://www.npmjs.com/package/elasticsearch) dependency.
  - Removed unused `FluentD` legacy code/dependencies.

## 1. Pre-requisites

### 1.1 Elasticsearch

Ensure that you have created the following resources prior to deploying the ESP component:

1. [Create a Policy](#1111-create) with the desired Rollover configurations: [policy-rollover-mojaloop.json](./config/policy-rollover-mojaloop.json)
2. [Create a Template](#1121-create) to associate the Policy Settings to the Logstash index based on the following config: [template-mojaloop.json](./config/template-mojaloop.json)

> **NOTE**:
> If ESP component is running prior to configuring the above template, the index mapping will be auto-created and will not take effect.

#### 1.1.1 Mojaloop Index Rollover Policy

##### 1.1.1.1 Create

```curl
curl -X PUT "http://elasticsearch:9200/_ilm/policy/mojaloop_rollover_policy?pretty" -H 'Content-Type: application/json' -d @config/policy-rollover-mojaloop.json
```

curl -X PUT "http://localhost:9200/_ilm/policy/mojaloop_rollover_policy?pretty" -H 'Content-Type: application/json' -d @config/policy-rollover-mojaloop.json

##### 1.1.1.2 Delete

> **NOTE**:
> only needed if you need to remove the policy_

```curl
curl -X DELETE "http://elasticsearch:9200/_ilm/policy/mojaloop_rollover_policy?"
```

#### 1.1.1.3 Get

> **NOTE**:
> useful for debugging issues_

```curl
curl -X GET "http://elasticsearch:9200/_ilm/policy/mojaloop_rollover_policy?"
```

#### 1.1.2 Mojaloop Index Template

##### 1.1.2.1 Create

```curl
curl -X PUT "http://elasticsearch:9200/_template/moja_template?pretty" -H 'Content-Type: application/json' -d @config/template-mojaloop.json
```

curl -X PUT "http://localhost:9200/_template/moja_template?pretty" -H 'Content-Type: application/json' -d @config/template-mojaloop.json'

##### 1.1.2.2 Delete

> **NOTE**:
> only needed if you need to remove the template_

 ```curl
 curl -X DELETE "http://elasticsearch:9200/_template/moja_template"
 ```

#### 1.1.3 Get Template

 > **NOTE**:
 useful for debugging template issues_

 ```curl
 curl -X GET "http://elasticsearch:9200/_template/moja_template"
 ```

## Testing

### Local

1. Run Docker-compose which will start up the following dependencies:

    1. Kafka - Message Bus
    2. ElasticSearch - Event Indexing of all Event types (traces, audits, errors, logs, etc) from the `event-topic`
    3. APM - Application Monitoring for Trace event
    4. Kibana - ElasticSearch UI
    5. Kowl - Helpful UI for managing/monitoring/querying Kafka visually

    ```bash
    cd ./docker
    docker-compose up -d
    ```

2. Helper script to produce a single sample message using [kcat](https://github.com/edenhill/kcat)

    ```bash
    sh ./docker/kafka-produces-single.sh
    ```

3. Helper script to produce a multiple sample messages using [kcat](https://github.com/edenhill/kcat)

    ```bash
    sh ./docker/kafka-produces-multi.sh
    ```

## Auditing Dependencies

We use `npm-audit-resolver` along with `npm audit` to check dependencies for node vulnerabilities, and keep track of resolved dependencies with an `audit-resolve.json` file.

To start a new resolution process, run:

```bash
npm run audit:resolve
```

You can then check to see if the CI will pass based on the current dependencies with:

```bash
npm run audit:check
```

And commit the changed `audit-resolve.json` to ensure that CircleCI will build correctly.

## Container Scans

As part of our CI/CD process, we use anchore-cli to scan our built docker container for vulnerabilities upon release.

If you find your release builds are failing, refer to the [container scanning](https://github.com/mojaloop/ci-config#container-scanning) in our shared Mojaloop CI config repo. There is a good chance you simply need to update the `mojaloop-policy-generator.js` file and re-run the circleci workflow.

For more information on anchore and anchore-cli, refer to:

- [Anchore CLI](https://github.com/anchore/anchore-cli)
- [Circle Orb Registry](https://circleci.com/orbs/registry/orb/anchore/anchore-engine)

## Automated Releases

As part of our CI/CD process, we use a combination of CircleCI, standard-version
npm package and github-release CircleCI orb to automatically trigger our releases
and image builds. This process essentially mimics a manual tag and release.

On a merge to master, CircleCI is configured to use the mojaloopci github account
to push the latest generated CHANGELOG and package version number.

Once those changes are pushed, CircleCI will pull the updated master, tag and
push a release triggering another subsequent build that also publishes a docker image.

### Potential problems

- There is a case where the merge to master workflow will resolve successfully, triggering
  a release. Then that tagged release workflow subsequently failing due to the image scan,
  audit check, vulnerability check or other "live" checks.

  This will leave master without an associated published build. Fixes that require
  a new merge will essentially cause a skip in version number or require a clean up
  of the master branch to the commit before the CHANGELOG and bump.

  This may be resolved by relying solely on the previous checks of the
  merge to master workflow to assume that our tagged release is of sound quality.
  We are still mulling over this solution since catching bugs/vulnerabilities/etc earlier
  is a boon.

- It is unknown if a race condition might occur with multiple merges with master in
  quick succession, but this is a suspected edge case.
