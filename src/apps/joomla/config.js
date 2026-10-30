export default {
    tag: {
        pattern: /^(\d+\.\d+(\.\d)?)-apache$/
    },
    services: {
        joomladb: {
            tag: {
                pattern: /^8\.4(\.\d+)?$/
            }
        }
    }
}
