const d = require('./deck')
const tf = require('@tensorflow/tfjs')

// require('@tensorflow/tfjs-node')

class Agent{
    constructor(stateSize, modelName = 'DQN', gamma = 0.95, epsilon = 1.0, epsMin = 0.01, epsDecay = 0.95, lr = 0.001){
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
        model.add(tf.layers.dense({units: 256, inputDim: this.stateSize, activation: 'relu'}))
        // model.add(tf.layers.dense({units: 32, activation: 'relu'}))
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

    addTrumpConcat(trump, tensor){
        return new Promise(resolve => {
            // console.log(name, tensor)
            if(tensor.length === 0){
                return resolve(tf.zeros([40, 15]).arraySync())
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
            const out = trumpedTensor.pad([[0, 40 - trumpedTensor.shape[0]], [0,0]]).arraySync()
            // console.debug('concat')
            console.log(out)
            return resolve(out)
        })
    }

    async getState(state){
        const {trump, hand, table, played} = state
        const stateHand = await this.addTrumpConcat(trump, hand)
        const stateTable = await this.addTrumpConcat(trump, table)
        const statePlayed = await this.addTrumpConcat(trump, played)        
        // await Promise.all([stateHand, stateTable, statePlayed])
        // console.debug('getState')
        return [stateHand, stateTable, statePlayed]
   
            // return [stateHand, stateTable, statePlayed]

 
    }

    async takeAction(state, hand){
        // console.debug('takeAction')            
        const random = Math.floor(Math.random() * hand)
        if(Math.random() <= this.epsilon){
            // console.log('Random AI')
            return random
        }
        // console.log('Take action AI')
        const stateInput = await tf.concat(state).flatten().reshape([1, this.stateSize])
        const p = await this.model.predict(stateInput)
        stateInput.print()
        p.print()
        // console.log(p.argMax().dataSync()[0])
        // console.log(stateInput.shape)
        // console.log(p.argMax().dataSync()[0])
        const pred = p.argMax().dataSync()[0]
        // console.debug(hand, p.dataSync())
        const action = pred >= hand ? random : pred
        stateInput.dispose()
        p.dispose()
        console.debug('Action:', action, pred)
        return action
    }

    async expReplay(){
        console.debug('Training...')
        const minibatch = await this.memory.concat().sort(() => .5 - Math.random()).slice(0, this.batchSize)
        // console.debug(minibatch)
        for (let i = 0; i < minibatch.length - 1; i++) {
            let [state, action, reward, next_state, done] = minibatch[i]
            // console.debug(state, next_state)
            // console.log(minibatch[i])
            state = await tf.concat(state).flatten().reshape([1, this.stateSize])
            next_state = await tf.concat(next_state).flatten().reshape([1, this.stateSize])
            let target = reward
            // console.log(next_state.shape, state.shape)

            if (!done) {
                let predictNext = await this.model.predict(next_state)
                // let y = predictNext.argMax().dataSync()[0]
                target = reward + this.gamma * predictNext.argMax().dataSync()[0]
                // console.log(target)
            }

            let target_f = await this.model.predict(state).dataSync()
            // console.log(target_f)
            target_f[action] = target
            target_f = await tf.tensor2d(target_f, [1, this.actionSize])
            // target_f.print()
            // console.log(target_f.shape)
            // target_f.print()
            // target_f = tf.tensor2d(target_f, [1, this.actionSize])//.reshape([1,3])
            await this.model.fit(state, target_f, {
                epochs: 1,
                verbose: 1,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        // console.log(logs)
                        process.stdout.write(`${logs.loss} ${logs.acc}                             \r`)
                    }
                }
            })

            await state.dispose()
            await next_state.dispose()
            await target_f.dispose()
        }
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay
        }
        // console.debug('Training... stop!')
        return 'Training... stop!'
    }
}

module.exports = Agent
