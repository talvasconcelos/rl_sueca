const Game = require('./sueca')
const Agent = require('./agentDQN')
const agent = new Agent(44)

const train = async _ => {
    for (let index = 0; index < 1000; index++) {
        console.log('Game:', index + 1)
        const game = new Game(agent, index > 250)
        await game.startGame()
    }
}

train()



// const game = new Game()
// game.startGame()