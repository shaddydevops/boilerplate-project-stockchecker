'use strict';

const fetch = require('node-fetch');
const Stock = require('../models/stock'); // MongoDB model
const crypto = require('crypto'); // For anonymizing IPs

module.exports = function (app) {
  const anonymizeIP = (ip) => crypto.createHash('sha256').update(ip).digest('hex');

  app.route('/api/stock-prices')
    .get(async (req, res) => {
      const { stock, like } = req.query;
      const ip = anonymizeIP(req.ip); // Anonymized IP for privacy

      if (!stock) {
        return res.status(400).json({ error: 'Stock symbol is required' });
      }

      try {
        const stocks = Array.isArray(stock) ? stock : [stock];
        const stockData = await Promise.all(stocks.map(async (symbol) => {
          const apiUrl = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`;
          const response = await fetch(apiUrl);
          const data = await response.json();

          if (!data || data.error) {
            throw new Error(`Failed to fetch data for stock: ${symbol}`);
          }

          let stockRecord = await Stock.findOne({ symbol });
          if (!stockRecord) {
            stockRecord = new Stock({ symbol, likes: [] });
          }

          if (like && !stockRecord.likes.includes(ip)) {
            stockRecord.likes.push(ip);
            await stockRecord.save();
          }

          return {
            stock: symbol,
            price: data.latestPrice || 'N/A',
            likes: stockRecord.likes.length,
          };
        }));

        res.json({
          stockData: Array.isArray(stock) ? stockData : stockData[0],
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
};
