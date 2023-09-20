export default {
    tag: {
        pattern: /^(\d+(\.\d+(\.\d)?)?)$/
    },
    services: {
        typesense: {
            tag: {
                pattern: /^(\d+(\.\d+(\.\d)?)?)$/
            }
        },
        broker: {
            tag: {
                pattern: /^\d+(\.\d+(\.\d)?)?$/
            }
        },
        db: {
            tag: {
                pattern: /^\d+(\.\d+(\.\d)?)?$/
            }
        }
    }
}