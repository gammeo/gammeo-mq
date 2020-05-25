# GammeoMQ

GammeoMQ is a distributed message queue. It uses custom store and transport to be software agnostic.

## Setup

To install the package you must first be logged in the GitHub registry:

_Tip: Go to [Authenticating to GitHub Packages](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages) for more information._

```sh
npm login --registry=https://npm.pkg.github.com/
```

and then you can install it:

```sh
npm install @studiomagnetique/gammeo-mq
```

## Usage

```js
import { MessageQueue, InMemoryStore, InMemoryTransport } from '@studiomagnetique/gammeo-mq';

// the queue can take options as third argument but this one is optional
const queue = new MessageQueue(new InMemoryStore(), new InMemoryTransport(), {
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
const queue = new MessageQueue(store, transport, {
    retryInterval: 100,
    maxRetryAttempts: 3,
});
```

## Tests

The test env uses docker to get a running mongodb and redis to test the MongoDBStore and RedisStore. To run them accross the provided docker-compose file run:

```sh
npm run docker test
```

## Publish

First, make sure you've bumped the version number and update the changelog.

To publish the package you must first be logged in the GitHub registry:

_Tip: Go to [Authenticating to GitHub Packages](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages#authenticating-to-github-packages) for more information._

```sh
npm login --registry=https://npm.pkg.github.com/
```

Then just run: `npm publish`
