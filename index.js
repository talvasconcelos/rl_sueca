const Game = require('./game')
const d = require('./deck')
const Agent = require('./agentDQN')
const agent = new Agent(15)

const game = new Game(agent)

game.startGame()