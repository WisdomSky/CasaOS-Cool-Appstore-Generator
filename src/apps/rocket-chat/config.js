export default {
    tag: {
        pattern: /^\d+\.\d+(\.\d+)?$/
    },
    services: {
        db: {
            tag: {
                pattern: /^8\.0(\.\d+)?$/
            }
        }
    }
}
