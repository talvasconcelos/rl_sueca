const d = require('./deck')
const tf = require('@tensorflow/tfjs')

class Agent{
    constructor(stateSize, modelName = 'DQN', gamma = 0.95, epsilon = 1.0, epsMin = 0.01, epsDecay = 0.95, lr = 0.01){
        this.stateSize = stateSize
        this.actionSize = 10
        this.memory = []
        this.maxMem = 200000
        this.state = null
        this.nextState = null
        this.reward = null
        this.modelName = modelName
        this.deck = d.makeDeck()
        this.suits = this.encode(this.deck.suits)
        this.nums = this.encode(this.deck.nums)

        this.gamma = gamma
        this.epsilon = epsilon
        this.epsilonMin = epsMin
        this.epsilonDecay = epsDecay

        this.lr = lr

        this.model = this.model()
    }

    model(){
        const model = tf.sequential()
        model.add(tf.layers.dense({units: 64, inputShape: [this.stateSize], activation: 'relu'}))
        model.add(tf.layers.dense({units: 128, activation: 'relu'}))
        model.add(tf.layers.dense({units: this.actionSize, activation: 'softmax'}))

        model.compile({
            optimizer: tf.train.adam({learningRate: this.lr}),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        })
        model.summary()

        return model
    }

    encode(arr){
        const idx = arr.map((_, i) => i)
        const enc = tf.oneHot(idx, arr.length)
        // enc.print()
        return enc.arraySync()
    }

    addTrumpConcat(trump, tensor, name){
        // console.log(name, tensor)
        if(tensor.length === 0){
            return tf.zeros([40, 15]).arraySync()
        }
        const x = tensor.map(c => {
            const isTrump = c.suit === trump
            return tf.concat([
                this.suits[c.idx[0]],
                this.nums[c.idx[1]],
                isTrump ? tf.tensor1d([1]) : tf.tensor1d([0])
            ]).arraySync()
        })
        const trumpedTensor = tf.tensor(x)
        return trumpedTensor.pad([[0, 40 - trumpedTensor.shape[0]], [0,0]])
    }

    getState(state){
        const {trump, hand, table, played} = state
        const stateHand = this.addTrumpConcat(trump, hand, 'hand')
        const stateTable = this.addTrumpConcat(trump, table, 'table')
        const statePlayed = this.addTrumpConcat(trump, played, 'played')
        return [stateHand, stateTable, statePlayed]
    }

    takeAction(state, hand){
        const random = Math.floor(Math.random() * hand.length)
        if(Math.random() <= this.epsilon){
            // console.log('Random AI')
            return random
        }
        return tf.tidy(() => {
            // console.log('Take action AI')
            const stateInput = tf.concat(state)
            let p = this.model.predict(stateInput)
            // console.log(p.argMax().dataSync()[0])
            p = p.argMax().dataSync()
            return p[0] >= hand.length ? random : p[0]
        })
    }

    expReplay(){
        // const minibatch = 
    }
}

module.exports = Agent
