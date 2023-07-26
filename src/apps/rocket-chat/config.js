export default {
    tag: {
        pattern: /^\d+\.\d+(\.\d+)?$/
    },
    services: {
        database: {
            tag: {
                pattern: /^\d+(\.\d+(\.\d+)?)?$/
            }
        }
    }
}