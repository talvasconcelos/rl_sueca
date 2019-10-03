const tf = require('@tensorflow/tfjs')

const chunck = (input, size) => {
    return input.reduce((arr, item, idx) => {
        return idx % size === 0
            ? [...arr, [item]]
            : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]]
    }, [])
}

const encode = (arr) => {
    const idx = arr.map((_, i) => i)
    const enc = tf.oneHot(idx, arr.length)
    // enc.print()
    return enc
}

module.exports = {
    makeDeck: () => {
        const suits = ['c', 'd', 'h', 's']
        const nums = ['2', '3', '4', '5', '6', 'q', 'j', 'k', '7', 'a']
        const points = [0, 0, 0, 0, 0, 2, 3, 4, 10, 11]
        const deck = []
        for (let i = 0; i < suits.length; i++) {
            for (let j = 0; j < nums.length; j++) {
                deck.push({
                    suit: suits[i],
                    number: nums[j],
                    points: points[j],
                    idx: [i, j]
                    // oneHot: tf.concat([suitsEnc.arraySync()[i], numsEnc.arraySync()[j]])
                })
            }
        }
        return {deck, suits, nums, points}
    },

    shuffleDeck: (deck) => {
        const shuffleDeck = deck
        // Fisher-Yates
        for (let i = shuffleDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * i)
            const temp = shuffleDeck[i]
            shuffleDeck[i] = shuffleDeck[j]
            shuffleDeck[j] = temp
        }
        return shuffleDeck
    },

    dealHand: (deck, side) => {
        const cardsPerHand = 10
        const hands = chunck(deck, cardsPerHand)
        return side === 1 ? hands : hands.reverse()
    },

    getTrump: (deck, side) => {
        const trump = side === 1 ? deck[0] : deck[deck.length - 1]
        return trump.suit
    }
}