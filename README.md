# Gatsby Source Plugin for Flamelink

Source plugin for pulling data into Gatsby v2 from [Flamelink](https://flamelink.io).

## Install

```shell
npm install --save gatsby-source-flamelink
```

or

```shell
yarn add gatsby-source-flamelink
```

## How to use

// In your gatsby-config.js

```javascript
plugins: [
  {
    resolve: 'gatsby-source-flamelink',
    options: {
      firebaseConfig: {
        pathToServiceAccount: 'path/to/serviceAccountKey.json',
        databaseURL: 'https://<DATABASE_NAME>.firebaseio.com',
        storageBucket: '<PROJECT_ID>.appspot.com'
      },
      dbType: 'cf',
      environment: 'production',
      content: true,
      populate: true,
      navigation: true,
      globals: true
    }
  }
]
```

## Debug

To see debug information in your terminal, you can optionally opt into these messages by setting the `DEBUG` environment variable when starting Gatsby.

Log all error messages:

```shell
DEBUG=flamelink:error gatsby develop
```

Log all warning messages:

```shell
DEBUG=flamelink:warning gatsby develop
```

Log all info messages:

```shell
DEBUG=flamelink:info gatsby develop
```

Log all Flamelink messages:

```shell
DEBUG=flamelink:* gatsby develop
```

## Options

### firebaseConfig

**Type: `{Object}`**

The only mandatory config is the Firebase Config object which allows Flamelink to connect to your Firebase project. You must always specify the `databaseURL` and `storageBucket`, and then you have 2 options to specify the necessary credentials for the connection to take place:

- Specify the absolute path to your Firebase Service Account file as `pathToServiceAccount`
- If you cannot reference your service account file, you can specify the individual fields instead:

```javascript
{
  projectId: '<PROJECT_ID>',
  clientEmail: 'foo@<PROJECT_ID>.iam.gserviceaccount.com',
  privateKey: '-----BEGIN PRIVATE KEY-----\n<KEY>\n-----END PRIVATE KEY-----\n',
}
```

Whichever is easiest to you, we're easy.

> If you want to read up more about how to setup the Firebase admin SDK, [go here](https://firebase.google.com/docs/admin/setup). You don't need this, it is for more info if you are not familiar with the service account required.

### dbType

**Type: `{String}`**

The type of Firebase database your are using. Can be one of `cf` or `rtdb`, for Cloud Firestore or Real-time Database respectively. Defaults to `rtdb`.

```javascript
{
  dbType: 'rtdb'
}
```

### environment

**Type: `{String}`**

The Flamelink environment. Defaults to `production`.

```javascript
{
  environment: 'staging'
}
```

### locales

**Type: `{Array}`**

The Flamelink locales. Defaults to whichever locales are available in your project.

```javascript
{
  locales: ['en-US']
}
```

### globals

**Type: `{Boolean}`**

Whether your Flamelink project's globals should be included in the GraphQL server as `allFlamelinkGlobals`. Defaults to `true`.

```javascript
{
  globals: false
}
```

### content

**Type: `{Boolean|Array}`**

Whether your Flamelink project's content should be included in the GraphQL server as `allFlamelink{ContentType}Content`. Defaults to `true`.

If value is set to `true`, all available content types will be included.

For fine-grained control, you can specify an array of arrays for the specific content types you want, including any options, like: `['<contentType>', '<options>']`

```javascript
{
  content: [
    { schemaKey: 'blog-posts', populate: true },
    { schemaKey: 'products', populate: ['image'] },
    { schemaKey: 'homepage', populate: false, fields: ['title', 'description'] }
  ]
}
```

Any [options available for the SDK](https://flamelink.github.io/flamelink/#/content?id=available-options) are also available here.

> This example will be available in the Gatsby GraphQL server as `allFlamelinkBlogPostsContent`, `allFlamelinkProductsContent` and `allFlamelinkHomepageContent` respectively.

### populate

**Type: `{Boolean|Array}`**

Whether your Flamelink project's relational and media content should be automatically populated or not. Defaults to `true`.

> **IMPORTANT!** If the `content` option is an array, this global `populate` option is ignored.

If value is set to `true`, all available content will be populated to the deepest level possible, ie. get all the things!! This is by far the easiest option, just keep an eye on it if you find that the build gets too slow.

Alternatively, specify an array with specific fields to populate. This option is global for all content, so it might not be relevant for all content. You can also use the array-of-arrays option for `content` if you need to specify different `populate` options per content type. Take a look at the [Flamelink SDK docs](https://flamelink.github.io/flamelink/#/content?id=populate) for more info on how the `populate` option works.

```javascript
{
  populate: true
}
```

### navigation

**Type: `{Boolean|Array}`**

Whether your Flamelink project's navigation menus should be included in the GraphQL server as `allFlamelink{NavigationName}Navigation`. Defaults to `true`.

If value is set to `true`, all available content types will be included.

For fine-grained control, you can specify an array of arrays for the specific navigation menus you want, like: `['<key>', '<options>']`

```javascript
{
  navigation: [
    { navigationKey: 'main', structure: 'nested' },
    { navigationKey: 'secondary', structure: 'list' }
  ]
}
```

> This example will be available in the Gatsby GraphQL server as `allFlamelinkMainNavigation` and `allFlamelinkSecondaryNavigation` respectively.

## How to query your data

**IMPORTANT!** Since certain fields are reserved for internal use by Gatsby, the following fields are renamed in your data:

```text
id => flamelink_id
children => flamelink_children
parent => flamelink_parent
fields => flamelink_fields
internal => flamelink_internal
__meta__ => flamelink___meta__
```

There is also an additional property, `flamelink_locale` available on all content and navigation nodes which will be set to the particular locale you have specified for the entry.

Further, all `flamelink_id`s are always strings.

### Get Global data

```graphql
query {
  allFlamelinkGlobals {
    edges {
      node {
        id
        flamelink_id
        adminEmail
        dateFormat
        siteTitle
        tagline
        timeFormat
        timezone
        flamelink__meta_ {
          createdBy
          createdDate
          lastModifiedBy
          lastModifiedDate
        }
      }
    }
  }
}
```

### Get specific content type for a locale (Products for instance)

```graphql
query {
  allFlamelinkProductsContent(filter: { flamelink_locale: { eq: "en-US" } }) {
    edges {
      node {
        flamelink_id
        name
        description
        price
        image {
          flamelink_id
          file
          folderId
          type
          contentType
          url
          sizes {
            height
            quality
            width
          }
          flamelink__meta_ {
            createdBy
            createdDate
            lastModifiedBy
            lastModifiedDate
          }
        }
      }
    }
  }
}
```

### Get navigation type for a specific locale (Main for instance)

```graphql
query {
  allFlamelinkMainNavigation(filter: { flamelink_locale: { eq: "en-US" } }) {
    edges {
      node {
        id
        flamelink_id
        title
        items {
          attachment
          component
          cssClass
          order
          parentIndex
          title
          url
          uuid
          flamelink_id
          flamelink_children {
            attachment
            component
            cssClass
            order
            parentIndex
            title
            url
            uuid
            flamelink_id
          }
        }
      }
    }
  }
}
```
