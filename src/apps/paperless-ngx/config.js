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
        },
        tika: {
            tag: {
                pattern: /^3\.\d+(\.\d+){0,2}$/
            }
        },
        gotenberg: {
            tag: {
                pattern: /^8\.\d+(\.\d+)?$/
            }
        }
    }
}
