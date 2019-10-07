const Game = require('./sueca')
// const Agent = require('./agentDQN')
// const agent = new Agent(15)

const train = async _ => {
    for (let index = 0; index < 5; index++) {
        console.log('Game:', index + 1)
        const game = new Game()
        await game.startGame()
    }
}

train()



// const game = new Game()
// game.startGame()