const env = require("../config/env");
const contentApi = require("./contentApi");
const contentMock = require("./contentMock");

function getSource() {
  return env.isMockMode() ? contentMock : contentApi;
}

function getContentItems(filters = {}) {
  return getSource().getContentItems(filters);
}

function getContentItemById(id) {
  return getSource().getContentItemById(id);
}

function getTypeOptions() {
  return getSource().getTypeOptions();
}

function getCategoryOptions() {
  return getSource().getCategoryOptions();
}

function getTagOptions() {
  return getSource().getTagOptions();
}

module.exports = {
  getContentItems,
  getContentItemById,
  getTypeOptions,
  getCategoryOptions,
  getTagOptions
};
