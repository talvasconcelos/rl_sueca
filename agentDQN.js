const d = require('./deck')
const tf = require('@tensorflow/tfjs')

require('@tensorflow/tfjs-node')

class Agent{
    constructor(stateSize, modelName = 'DQN', gamma = 0.95, epsilon = 1.0, epsMin = 0.01, epsDecay = 0.95, lr = 0.01){
        this.stateSize = stateSize
        this.actionSize = 10
        this.batchSize = 32
        this.memory = []
        this.maxMem = 100000
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
        model.add(tf.layers.dense({units: 128, inputShape: [this.stateSize], activation: 'relu'}))
        // model.add(tf.layers.dense({units: 128, activation: 'relu'}))
        model.add(tf.layers.dense({units: this.actionSize, activation: 'softmax'}))

        model.compile({
            optimizer: tf.train.adam({learningRate: this.lr}),
            loss: 'meanSquaredError',
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
        console.debug('concat')
        return new Promise(resolve => {

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
            return resolve(trumpedTensor.pad([[0, 40 - trumpedTensor.shape[0]], [0,0]]).arraySync())
        })
    }

    getState(state){
        console.debug('getState')
        const {trump, hand, table, played} = state
        const stateHand = this.addTrumpConcat(trump, hand, 'hand')
        const stateTable = this.addTrumpConcat(trump, table, 'table')
        const statePlayed = this.addTrumpConcat(trump, played, 'played')
        Promise.all([stateHand, stateTable, statePlayed]).then(() => {
            return [stateHand, stateTable, statePlayed]
        })
        // return [stateHand, stateTable, statePlayed]
    }

    takeAction(state, hand){
        console.debug('takeAction')
        return tf.tidy(() => {
            const random = Math.floor(Math.random() * hand)
            if(Math.random() <= this.epsilon){
                // console.log('Random AI')
                return random
            }
            // console.log('Take action AI')
            const stateInput = tf.concat(state)
            let p = this.model.predict(stateInput)
            // console.log(p.argMax().dataSync()[0])
            p = p.argMax().dataSync()
            return p[0] >= hand ? random : p[0]
        })
    }

    async expReplay(){
        console.debug('Training...')
        const minibatch = this.memory.concat().sort(() => .5 - Math.random()).slice(0, this.batchSize)
        // console.debug(minibatch)
        for (let i = 0; i < minibatch.length - 1; i++) {
            let [state, action, reward, next_state, done] = minibatch[i]
            // console.log(minibatch[i])
            // console.debug(state)
            state = tf.concat(state)
            next_state = tf.concat(next_state)
            let target = reward

            if (!done) {
                let predictNext = this.model.predict(next_state)
                // let y = predictNext.argMax().dataSync()[0]
                target = reward + this.gamma * predictNext.argMax().dataSync()[0]
            }

            let target_f = this.model.predict(state).dataSync()
            target_f[action] = target

            // target_f = tf.tensor2d(target_f, [1, this.actionSize])//.reshape([1,3])
            this.model.fit(state, target_f, {
                epochs: 1,
                verbose: 1,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        process.stdout.write(`${logs.loss} ${logs.acc}            \r`)
                    }
                }
            })

            state.dispose()
            next_state.dispose()
            target_f.dispose()
        }
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay
        }
        // console.debug('Training... stop!')
        return 'Training... stop!'
    }
}

module.exports = Agent
