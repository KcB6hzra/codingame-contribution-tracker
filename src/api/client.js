/**
 * CodinGame API Client
 */
export default class CodinGameAPI {
  constructor(cookie, userId) {
    this.cookie = cookie;
    this.userId = userId;
    this.baseUrl = 'https://www.codingame.com/services';
  }

  async _fetch(service, method, body) {
    const response = await fetch(`${this.baseUrl}/${service}/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'cookie': this.cookie,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getAllPendingContributions() {
    return await this._fetch('Contribution', 'getAllPendingContributions', [1, "ALL", this.userId]);
  }

  async getAcceptedContributions() {
    return await this._fetch('Contribution', 'getAcceptedContributions', ["ALL"]);
  }

  async findContribution(publicHandle) {
    return await this._fetch('Contribution', 'findContribution', [publicHandle, true]);
  }

  async getFirstLevelComments(commentableId) {
    return await this._fetch('Comment', 'getFirstLevelComments', [this.userId, commentableId]);
  }

  async getSecondLevelComments(commentId) {
    return await this._fetch('Comment', 'getSecondLevelComments', [this.userId, commentId]);
  }
}
