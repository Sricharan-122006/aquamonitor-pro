const mongoose = require('mongoose');
const { getLocalCollection } = require('./local-db');

const User = require('../models/User');
const Station = require('../models/Station');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Report = require('../models/Report');
const Subscription = require('../models/Subscription');
const Contact = require('../models/Contact');
const Threshold = require('../models/Threshold');
const Complaint = require('../models/Complaint');
const CommunityIssue = require('../models/CommunityIssue');
const CommunityNotification = require('../models/CommunityNotification');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

class RepositoryWrapper {
  constructor(modelName, MongooseModel) {
    this.modelName = modelName;
    this.MongooseModel = MongooseModel;
    this.localCol = getLocalCollection(modelName);
  }

  async find(query = {}, sort = null) {
    if (isMongoConnected()) {
      let q = this.MongooseModel.find(query);
      if (sort) q = q.sort(sort);
      return await q.lean();
    }
    let results = await this.localCol.find(query);
    if (sort) {
      const keys = Object.keys(sort);
      results.sort((a, b) => {
        for (const k of keys) {
          const dir = sort[k];
          if (a[k] < b[k]) return dir === 1 ? -1 : 1;
          if (a[k] > b[k]) return dir === 1 ? 1 : -1;
        }
        return 0;
      });
    }
    return results;
  }

  async findOne(query = {}) {
    if (isMongoConnected()) {
      return await this.MongooseModel.findOne(query).lean();
    }
    return await this.localCol.findOne(query);
  }

  async findById(id) {
    if (isMongoConnected()) {
      return await this.MongooseModel.findById(id).lean();
    }
    return await this.localCol.findById(id);
  }

  async create(doc) {
    if (isMongoConnected()) {
      const created = await this.MongooseModel.create(doc);
      return created.toObject();
    }
    return await this.localCol.create(doc);
  }

  async insertMany(docs) {
    if (isMongoConnected()) {
      return await this.MongooseModel.insertMany(docs);
    }
    return await this.localCol.insertMany(docs);
  }

  async findByIdAndUpdate(id, update, options = { new: true }) {
    if (isMongoConnected()) {
      return await this.MongooseModel.findByIdAndUpdate(id, update, options).lean();
    }
    return await this.localCol.findByIdAndUpdate(id, update, options);
  }

  async findOneAndUpdate(query, update, options = { new: true }) {
    if (isMongoConnected()) {
      return await this.MongooseModel.findOneAndUpdate(query, update, options).lean();
    }
    return await this.localCol.findOneAndUpdate(query, update, options);
  }

  async findByIdAndDelete(id) {
    if (isMongoConnected()) {
      return await this.MongooseModel.findByIdAndDelete(id).lean();
    }
    return await this.localCol.findByIdAndDelete(id);
  }

  async deleteMany(query = {}) {
    if (isMongoConnected()) {
      return await this.MongooseModel.deleteMany(query);
    }
    return await this.localCol.deleteMany(query);
  }

  async countDocuments(query = {}) {
    if (isMongoConnected()) {
      return await this.MongooseModel.countDocuments(query);
    }
    return await this.localCol.countDocuments(query);
  }
}

module.exports = {
  UserRepo: new RepositoryWrapper('users', User),
  StationRepo: new RepositoryWrapper('stations', Station),
  ReadingRepo: new RepositoryWrapper('readings', Reading),
  AlertRepo: new RepositoryWrapper('alerts', Alert),
  ReportRepo: new RepositoryWrapper('reports', Report),
  SubscriptionRepo: new RepositoryWrapper('subscriptions', Subscription),
  ContactRepo: new RepositoryWrapper('contacts', Contact),
  ThresholdRepo: new RepositoryWrapper('thresholds', Threshold),
  ComplaintRepo: new RepositoryWrapper('complaints', Complaint),
  CommunityIssueRepo: new RepositoryWrapper('community_issues', CommunityIssue),
  CommunityNotificationRepo: new RepositoryWrapper('community_notifications', CommunityNotification),
  isMongoConnected
};
