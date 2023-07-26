export default {
    tag: {
        pattern: /^\d+\.\d+(\.\d+)?$/
    },
    services: {
        db: {
            tag: {
                pattern: /^\d+(\.\d+(\.\d+)?)?$/
            }
        }
    }
}