export default {
    tag: {
        pattern: /^\d+(\.\d+){1,3}$/
    },
    services: {
        mariadb: {
            tag: {
                pattern: /^10\.11(\.\d+)?$/
            }
        }
    }
}
