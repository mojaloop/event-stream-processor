# event-stream-processor
** EXPERIMENTAL** Event Stream Processor for Event Stream (logs, audits, errors, trace, etc)

## 1. Pre-requisites

### 1.1 Elasticsearch

Ensure that you have created the `mojatemplate` based on the following config: [template](./config/template-mojaloop.json).

#### 1.1.1 Create Template
 ```curl
 curl -X PUT "http://localhost:9200/_template/mojatemplate?pretty" -H 'Content-Type: application/json' -d @config/template-mojaloop.json'
 ```

#### 1.1.2 Delete Template
_Note: only needed if you need to remove the template_
 ```curl
 curl -X DELETE "http://localhost:9200/_template/mojatemplate"
 ```
 
 #### 1.1.3 Get Template
 _Note: useful for debugging template issues_
 ```curl
 curl -X GET "http://localhost:9200/_template/mojatemplate"
 ```
 
 #### 1.1.4 Known Issues

  1. Elasticsearch returns field type error when document is tried to be insserted. If a custom template is not presented into Elasticsearch, when the first document is inserted, Elasticsearch assumes data model and creates index schema and won't work correctly with mojaloop. To fix the issue, you need to delete all old indexes. Even the index might not appear on the interface
     1. Get indexes starting with mojaloop
     ```curl
     curl -X GET 'localhost:9200/mojaloop*'
     ```
     2. Delete index by name
     ```curl
     curl -X DELETE 'localhost:9200/mojaloop-2020.04.30'
     ```
   