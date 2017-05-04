'use strict'
const request = require('request')
const newsUtils = require('../utils/news-utils')

const newsApi = 'http://newsapi.org'
const apiKey = require('../api-keys').newsApiKey
const config = require('../config.js')
const sources = require('./sources.json')
const maxArticles = config.maxArticlesStorageCap

/**
 * Retrieves relevant news using NewsAPI.org given a phrase.
 * @param  {string}   phrase
 * @param  {function} callback
 * @author Omar Chehab
 */
function getNews (phrase, callback) {
  if (!apiKey) {
    throw Error('News Module requires an API key from NewsAPI.org')
  }

  let articles = []
  let pending = sources.length

  const pattern = newsUtils.generateFuzzyPattern(phrase)

  sources.forEach(source => searchForArticlesFromSource(pattern, source,
   (error, response) => {
     pending--
     if (error) {
       console.error(`Request to ${source} failed`, error)
       return
     }

     articles = articles.concat(response)
     if (!pending) respond()
   })
  )

  function respond () {
    callback(reduceArticles(articles))
  }
}

/**
 * Requests NewsAPI.org for articles from a given source and returns an array of
 * articles that matches a given RegExp pattern.
 * @param  {RegExp}   pattern   describing what to find
 * @param  {string}   source    newsapi.org source id
 * @param  {function} callback  callback should be a function with two
 *                              parameters.
 *                              First parameter is error.
 *                              Second parameter is articles.
 * @author Omar Chehab
 */
function searchForArticlesFromSource (pattern, source, callback) {
  const url = `${newsApi}/v1/articles?source=${source.id}&apiKey=${apiKey}`
  let articles = []

  request(url, (error, response) => {
    if (error) {
      callback(error)
      return
    }

    response = JSON.parse(response.body)

    if (response.status !== 'ok') {
      const message = `NewsAPI returned status ${response.status} `
      callback(new Error(message))
      return
    }

    response.articles.forEach(article => {
      const title = article.title
      const titleMatches = title && pattern.test(title)
      const description = article.description
      const descriptionMatches = description && pattern.test(description)

      if (titleMatches || descriptionMatches) {
        const timestamp = new Date(article.publishedAt).getTime() / 1000
        articles.push({
          title: title,
          description: description,
          timestamp: timestamp,
          source: source.name,
          link: article.url,
          media: article.urlToImage
        })
      }
    })

    callback(undefined, articles)
  })
}

/**
 * pickArticles - Selects articles based on popularity of the a news source
 *
 * @author suchaHassle
 * @param  {Array} articles An array of objects for all news articles
 * @return {Array} An array of objects for the top news articles capped at configured amount
 */
function reduceArticles (articles) {
  if (articles.length <= maxArticles) {
    return articles
  }

  var count = 0
  var finalArticles = []

  // Iterate through the list of the sort news sources
  for (var i = 0; i < config.sources.length; i++) {
    // Add all articles from said news source
    for (var j = 0; j < articles.length; j++) {
      if (articles[j].id === config.sources[i]) {
        finalArticles.push(articles[j])
        count++
      }
      // Return if we've reached max cap
      if (count === config.maxArticlesStorageCap) {
        return finalArticles
      }
    }
  }
}

module.exports = {
  getNews: getNews
}
