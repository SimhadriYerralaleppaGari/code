const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  data: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('Document', documentSchema);
