const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class LocalCollection {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(DATA_DIR, `${name}.json`);
    this.items = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.items = JSON.parse(raw);
      } else {
        this.items = [];
        this.save();
      }
    } catch (err) {
      console.error(`Error loading collection ${this.name}:`, err.message);
      this.items = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.items, null, 2), 'utf8');
    } catch (err) {
      console.error(`Error saving collection ${this.name}:`, err.message);
    }
  }

  async find(query = {}) {
    this.load();
    return this.items.filter(item => this._matches(item, query));
  }

  async findOne(query = {}) {
    this.load();
    return this.items.find(item => this._matches(item, query)) || null;
  }

  async findById(id) {
    this.load();
    return this.items.find(item => item._id === id || item.id === id) || null;
  }

  async create(doc) {
    this.load();
    const newDoc = {
      _id: doc._id || crypto.randomUUID(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.items.push(newDoc);
    this.save();
    return newDoc;
  }

  async insertMany(docs) {
    this.load();
    const created = docs.map(doc => ({
      _id: doc._id || crypto.randomUUID(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    this.items.push(...created);
    this.save();
    return created;
  }

  async findByIdAndUpdate(id, update, options = { new: true }) {
    this.load();
    const idx = this.items.findIndex(item => item._id === id || item.id === id);
    if (idx === -1) return null;

    const current = this.items[idx];
    let updated = { ...current };

    if (update.$set) {
      Object.assign(updated, update.$set);
    } else {
      const plain = { ...update };
      delete plain.$push;
      delete plain.$pull;
      delete plain.$addToSet;
      Object.assign(updated, plain);
    }

    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(updated[k])) updated[k] = [];
        if (v && v.$each && Array.isArray(v.$each)) {
          updated[k].push(...v.$each);
        } else {
          updated[k].push(v);
        }
      }
    }

    if (update.$pull) {
      for (const [k, v] of Object.entries(update.$pull)) {
        if (Array.isArray(updated[k])) {
          updated[k] = updated[k].filter(x => x !== v && (typeof x !== 'object' || (x._id !== v && x.id !== v)));
        }
      }
    }

    if (update.$addToSet) {
      for (const [k, v] of Object.entries(update.$addToSet)) {
        if (!Array.isArray(updated[k])) updated[k] = [];
        if (!updated[k].includes(v)) {
          updated[k].push(v);
        }
      }
    }

    delete updated._id;
    this.items[idx] = {
      _id: current._id,
      ...updated,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.items[idx];
  }

  async findOneAndUpdate(query, update, options = { new: true }) {
    this.load();
    const idx = this.items.findIndex(item => this._matches(item, query));
    if (idx === -1) return null;

    const current = this.items[idx];
    let updated = { ...current };

    if (update.$set) {
      Object.assign(updated, update.$set);
    } else {
      const plain = { ...update };
      delete plain.$push;
      delete plain.$pull;
      delete plain.$addToSet;
      Object.assign(updated, plain);
    }

    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(updated[k])) updated[k] = [];
        if (v && v.$each && Array.isArray(v.$each)) {
          updated[k].push(...v.$each);
        } else {
          updated[k].push(v);
        }
      }
    }

    if (update.$pull) {
      for (const [k, v] of Object.entries(update.$pull)) {
        if (Array.isArray(updated[k])) {
          updated[k] = updated[k].filter(x => x !== v && (typeof x !== 'object' || (x._id !== v && x.id !== v)));
        }
      }
    }

    if (update.$addToSet) {
      for (const [k, v] of Object.entries(update.$addToSet)) {
        if (!Array.isArray(updated[k])) updated[k] = [];
        if (!updated[k].includes(v)) {
          updated[k].push(v);
        }
      }
    }

    delete updated._id;
    this.items[idx] = {
      _id: current._id,
      ...updated,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.items[idx];
  }

  async findByIdAndDelete(id) {
    this.load();
    const idx = this.items.findIndex(item => item._id === id || item.id === id);
    if (idx === -1) return null;
    const removed = this.items.splice(idx, 1)[0];
    this.save();
    return removed;
  }

  async deleteMany(query = {}) {
    this.load();
    const beforeCount = this.items.length;
    this.items = this.items.filter(item => !this._matches(item, query));
    this.save();
    return { deletedCount: beforeCount - this.items.length };
  }

  async countDocuments(query = {}) {
    this.load();
    return this.items.filter(item => this._matches(item, query)).length;
  }

  _matches(item, query) {
    for (const key of Object.keys(query)) {
      if (key === '$or' && Array.isArray(query.$or)) {
        const anyMatch = query.$or.some(subQ => this._matches(item, subQ));
        if (!anyMatch) return false;
        continue;
      }
      if (query[key] instanceof RegExp) {
        if (!query[key].test(String(item[key] || ''))) return false;
        continue;
      }
      if (typeof query[key] === 'object' && query[key] !== null) {
        if ('$regex' in query[key]) {
          const options = query[key].$options || '';
          const re = new RegExp(query[key].$regex, options);
          if (!re.test(String(item[key] || ''))) return false;
          continue;
        }
        if ('$ne' in query[key]) {
          if (item[key] === query[key].$ne) return false;
          continue;
        }
        if ('$in' in query[key] && Array.isArray(query[key].$in)) {
          if (!query[key].$in.includes(item[key])) return false;
          continue;
        }
        if ('$nin' in query[key] && Array.isArray(query[key].$nin)) {
          if (query[key].$nin.includes(item[key])) return false;
          continue;
        }
        if ('$exists' in query[key]) {
          const exists = item[key] !== undefined && item[key] !== null;
          if (query[key].$exists !== exists) return false;
          continue;
        }
        if ('$gte' in query[key]) {
          if (new Date(item[key]) < new Date(query[key].$gte)) return false;
        }
        if ('$lte' in query[key]) {
          if (new Date(item[key]) > new Date(query[key].$lte)) return false;
        }
        if ('$gt' in query[key]) {
          if (item[key] <= query[key].$gt) return false;
        }
        if ('$lt' in query[key]) {
          if (item[key] >= query[key].$lt) return false;
        }
        continue;
      }
      if (item[key] !== query[key]) {
        return false;
      }
    }
    return true;
  }
}

const collections = {};

function getLocalCollection(name) {
  if (!collections[name]) {
    collections[name] = new LocalCollection(name);
  }
  return collections[name];
}

module.exports = {
  getLocalCollection,
  LocalCollection
};
