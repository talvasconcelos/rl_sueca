const Game = require('./game')
const Agent = require('./agentDQN')
const agent = new Agent(15)

for (let index = 0; index < 3; index++) {
    const game = new Game(agent)
    game.startGame()
    console.log('Game:', index + 1)
}

// const game = new Game(agent)

// game.startGame()