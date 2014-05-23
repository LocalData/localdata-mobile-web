module.exports = {
  "Sign in" : function (client) {
    client
      .url("https://localhost:3443/mobile/#test")
      .waitForElementVisible("body", 1000)
      .assert.title("LocalData Survey")
      .assert.visible("#collector_name")
      .setValue("#collector_name", "nightwatch")
      .click("#collector-name-submit")
      .pause(1000)
      .assert.containsText("body", "Welcome, nightwatch")
      .end();
  }
};
