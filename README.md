# event-stream-processor
** EXPERIMENTAL** Event Stream Processor (ESP) for Event Stream (logs, audits, errors, trace, etc)

## 1. Pre-requisites

### 1.1 Elasticsearch

Ensure that you have created the following resources prior to deploying the ESP component:
1. [Create a Policy](#1111-create) with the desired Rollover configurations: [policy-rollover-mojaloop.json](./config/policy-rollover-mojaloop.json)
2. [Create a Template](#1121-create) to associate the Policy Settings to the Logstash index based on the following config: [template-mojaloop.json](./config/template-mojaloop.json)

> __NOTE__:<br/>
> If ESP component is running prior to configuring the above template, the index mapping will be auto-created and will not take effect.

<br/>

#### 1.1.1 Mojaloop Index Rollover Policy

##### 1.1.1.1 Create
```curl
curl -X PUT "http://elasticsearch:9200/_ilm/policy/mojaloop_rollover_policy?pretty" -H 'Content-Type: application/json' -d @config/policy-rollover-mojaloop.json
```

##### 1.1.1.2 Delete
_Note: only needed if you need to remove the policy_
```curl
curl -X DELETE "http://elasticsearch:9200/_ilm/policy/mojaloop_rollover_policy?"
```

#### 1.1.1.3 Get
_Note: useful for debugging issues_
```curl
curl -X GET "http://elasticsearch:9200/_ilm/policy/mojaloop_rollover_policy?"
```

#### 1.1.2 Mojaloop Index Template

##### 1.1.2.1 Create
```curl
curl -X PUT "http://elasticsearch:9200/_template/moja_template?pretty" -H 'Content-Type: application/json' -d @config/template-mojaloop.json'
```

##### 1.1.2.2 Delete
_Note: only needed if you need to remove the template_
 ```curl
 curl -X DELETE "http://elasticsearch:9200/_template/moja_template"
 ```
 
 #### 1.1.3 Get Template
 _Note: useful for debugging template issues_
 ```curl
 curl -X GET "http://elasticsearch:9200/_template/moja_template"
 ```
 
