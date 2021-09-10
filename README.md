# GammeoMQ

![Test with Docker](https://github.com/studiomagnetique/gammeo-mq/workflows/Test%20with%20Docker/badge.svg)

GammeoMQ is a distributed message queue. It uses custom store and transport to be software agnostic.

## Setup

To install the package you must first create a [Gitlab personal access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html).

You will have to set this token in your environment variables:

```sh
cp .bashrc .bashrc.bak
echo export GITLAB_AUTH_TOKEN=$YOUR_TOKEN >> .bashrc
source .bashrc
```

Warning ! The GITLAB_AUTH_TOKEN environment variable must be exported before all the NVM environment variables.

Then, you must configure the Gitlab package registry:

```sh
npm config set @gammeo:registry https://gitlab.com/api/v4/packages/npm/
npm config set -- '//gitlab.com/api/v4/projects/28316548/packages/npm/:_authToken' "${GITLAB_AUTH_TOKEN}"
npm config set -- '//gitlab.com/api/v4/packages/npm/:_authToken' "${GITLAB_AUTH_TOKEN}"
```

Then add a `.npmrc` file to your project and write in it:

```
@gammeo:registry=https://gitlab.com/api/v4/packages/npm/
'//gitlab.com/api/v4/packages/npm/:_authToken'="${GITLAB_AUTH_TOKEN}"
'//gitlab.com/api/v4/projects/28316548/packages/npm/:_authToken'="${GITLAB_AUTH_TOKEN}"
```

finally you can install it by running:

```sh
npm install @gammeo/gammeo-mq
```

## Usage

```js
import { MessageQueue, InMemoryStore, InMemoryTransport } from '@studiomagnetique/gammeo-mq';

// the queue can take options as third argument but this one is optional
const queue = new MessageQueue('MyAwesomeQueue', new InMemoryStore(), new InMemoryTransport(), {
    retryInterval: 100,
    maxRetryAttempts: 3,
});

const unsubscribe = queue.subscribe(['foo', 'bar'], function consumer(messages) => {
    // this consumer is now subscribed to foo and bar channels
    // messages is an array
    // when you want to cancel the subscription, you can call the unsubscribe callback returned by queue.subscribe()
});

queue.publish('foo', [{ hello: 'world' }]);
// when you subscribe to a channel, you also subscribe to all channels prefixed with the same name
queue.publish('foo:1', [{ hello: 'world' }]);
```

If you're intend to use the message queue accross several processes like workers, you must use a distributed store and transport, like the mongodb store and the redis transport:

```js
import { MessageQueue, MongoDBStore, RedisTransport } from '@studiomagnetique/gammeo-mq';

// the MongoDBStore takes the same arguments than the mongodb node client
const store = new MongoDBStore('mongodb://root:password@mongo:27017', {
    useUnifiedTopology: true,
});

// the RedisTransport takes the same arguments than the redis node client
const transport = new RedisTransport();
const queue = new MessageQueue(`MyAwesomeQueue ${process.pid}`, store, transport, {
    retryInterval: 100,
    maxRetryAttempts: 3,
});
```

## Development

To work on this module, just run `npm install` first.

### Tests

The test env uses docker to get a running mongodb and redis to test the MongoDBStore and RedisStore. To run them accross the provided docker-compose file run:

```sh
npm run docker test
```

### Publish

First, make sure you've bumped the version number and update the changelog.

To publish the package you must first you must first create a [Gitlab personal access token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html).

You will have to set this token in your environment variables:

```sh
cp .bashrc .bashrc.bak
echo export GITLAB_AUTH_TOKEN=$YOUR_TOKEN >> .bashrc
source .bashrc
```

Warning ! The GITLAB_AUTH_TOKEN environment variable must be exported before all the NVM environment variables.

Then, you must configure the Gitlab package registry:

```sh
npm config set @gammeo:registry https://gitlab.com/api/v4/packages/npm/
npm config set -- '//gitlab.com/api/v4/projects/28316548/packages/npm/:_authToken' "${GITLAB_AUTH_TOKEN}"
npm config set -- '//gitlab.com/api/v4/packages/npm/:_authToken' "${GITLAB_AUTH_TOKEN}"
```

Then add a `.npmrc` file to your project and write in it:

```
@gammeo:registry=https://gitlab.com/api/v4/packages/npm/
'//gitlab.com/api/v4/packages/npm/:_authToken'="${GITLAB_AUTH_TOKEN}"
'//gitlab.com/api/v4/projects/28316548/packages/npm/:_authToken'="${GITLAB_AUTH_TOKEN}"
```

Then just run: `npm publish`
