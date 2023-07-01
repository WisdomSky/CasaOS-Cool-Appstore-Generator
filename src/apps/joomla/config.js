export default {
    tag: {
        pattern: /^(\d+\.\d+(\.\d)?)-apache$/
    },
    services: {
        joomladb: {
            tag: {
                pattern: /^(\d+(\.\d+(\.\d)?)?)$/
            }
        }
    }
}