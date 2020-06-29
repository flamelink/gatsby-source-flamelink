# Contributing

> We love pull requests from everyone. By participating in this project, you
> agree to abide by our [code of conduct](CODE_OF_CONDUCT.md).

When contributing to this repository, please first discuss the change you wish to make via an issue before making a change.

## Setup

### Fork Repository

Fork, then clone the repo (replace `your-username`):

```sh
git clone git@github.com:your-username/gatsby-source-flamelink.git
```

### Install Dependencies

This project uses `yarn`. It is similar to `npm`. See [here][yarn] if you need to first set up `yarn` on your local machine.

```sh
yarn install
```

### Run Tests

It is a good idea to first run the tests to make sure they are passing on your local machine before you make any changes.

```sh
yarn test
```

### Make your changes

#### Run dev build

Run the Babel build that will watch for changes as you work.

```sh
yarn dev
```

#### Add separate Gatsby site to test with

Because of the nature of this plugin (being a [source plugin for Gatsby][gatsby-source-plugin]), it might be hard to make changes and testing your changes from within this repo only. For this reason, we suggest you create a separate test Gatsby repository by using one of their [starter templates][gatsby-starters].

For example:

```sh
gatsby new my-test-blog-site https://github.com/gatsbyjs/gatsby-starter-blog
```

#### Setup local plugin

Take a look at [Gatsby's guide][gatsby-local-plugin-guide] to see the different options for using this Flamelink source plugin as a local plugin for your test Gatsby site.

With the dev build watching for any changes and the plugin linked to your test site, you can now make any changes you want to the plugin's source code and re-run the build on your test site to test it.

### Test again

If possible, write some tests for your changes and make sure all tests are still passing.

```sh
yarn test
```

### Create Pull Request

Push to your fork and [submit a pull request][pr].

At this point you're waiting on us. We like to at least comment on pull requests
within three business days (and, typically, one business day). We may suggest
some changes or improvements or alternatives.

Some things that will increase the chance that your pull request is accepted:

- Write tests.
- Follow the project's current code style.
- Write a [good commit message][commit].

## For Maintainers

### Release new version

After a pull request has been successfully merged, a decision needs to be made how the change should be deployed.

Strictly follow [semver][semver] when versioning the changes.

#### Versioning

Check out the branch (`develop` or `master`) locally and double check that it can build error free.

If you are not working to a future alpha or beta release, you can easily bump the version number using `npm version`

```sh
npm version <version>
```

Where `<version>` should be replaced by either `major`, `minor` or `patch` according to semver.

> After committing the version change, remember to push the changes back up to the origin.

#### Release

This plugin is distributed via NPM and is available at: https://www.npmjs.com/package/gatsby-source-flamelink

> To publish to NPM, you need to have the relevant permissions. Speak to another maintainer to add you to the Flamelink organization on NPM if needed.

After ensuring you are logged into NPM with the relevant permissions, you can publish the new version.

Make sure you are in the root directory of the plugin and then run:

```sh
yarn publish .
```

This will publish to the main `latest` tag and should only be done for changes on the `master` branch.

If you want to release a dev or upcoming change, rather publish to a specific tag, like:

```sh
yarn publish . --tag next
```

The plugin will then be available to install via `npm add gatsby-source-flamelink@next` for instance.

[yarn]: https://classic.yarnpkg.com/en/docs/getting-started
[gatsby-starters]: https://www.gatsbyjs.org/docs/starters/
[gatsby-local-plugin-guide]: https://www.gatsbyjs.org/docs/creating-a-local-plugin/#developing-a-local-plugin-that-is-outside-your-project
[gatsby-source-plugin]: https://www.gatsbyjs.org/docs/creating-a-source-plugin/
[pr]: https://github.com/flamelink/gatsby-source-flamelink/compare/
[commit]: http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html
[semver]: https://semver.org/
