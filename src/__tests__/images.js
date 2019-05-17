const fs = require('fs')
const path = require('path')
const { locateImageFields } = require('../helpers/images')

const entry = JSON.parse(fs.readFileSync(path.join(__dirname, '/data.json'), 'utf8'))

describe('locateImageFields', () => {
  test('works with single object', () => {
    const result = locateImageFields({
      url: 'asdds',
      contentType: 'image/png'
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('contentType', 'image/png')
  })

  test('works with nested object', () => {
    const result = locateImageFields({
      image: {
        url: 'asdds',
        contentType: 'image/png'
      }
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('contentType', 'image/png')
  })

  test('works with nested array', () => {
    const result = locateImageFields({
      hero: [
        {
          url: 'asdds',
          contentType: 'image/png'
        }
      ]
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('contentType', 'image/png')
  })

  test('returns all images', () => {
    const result = locateImageFields([
      {
        url: 'asdds',
        contentType: 'image/jpg'
      },
      {
        url: 'asdds',
        contentType: 'image/png'
      },
      {
        image: {
          url: 'asdds',
          contentType: 'image/png'
        }
      }
    ])
    expect(result).toHaveLength(3)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('contentType', 'image/jpg')
  })

  test("doesn't return field with unsupported image type", () => {
    const result = locateImageFields({
      url: 'asdds',
      contentType: 'image/asdadadas'
    })
    expect(result).toHaveLength(0)
  })

  test('field test', () => {
    const result = locateImageFields(entry)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('contentType', 'image/png')
  })
})
