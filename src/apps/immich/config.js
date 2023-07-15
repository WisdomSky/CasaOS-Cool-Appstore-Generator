export default {
    tag: {
        pattern: /^v\d+\.\d+\.\d+$/
    },
    services: {
        typesense: {
            tag: {
                pattern: /^(\d+(\.\d+(\.\d)?)?)$/
            }
        },
        redis: {
            tag: {
                pattern: /^(\d+\.\d+(\.\d)?)-alpine$/
            }
        },
        database: {
            tag: {
                pattern: /^\d+(\.\d+(\.\d+)?)?$/
            }
        }
    }
}