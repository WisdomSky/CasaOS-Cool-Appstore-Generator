
![CasaOS Coolstore](https://raw.githubusercontent.com/WisdomSky/CasaOS-Coolstore/main/banner.png)

# CasaOS Coolstore

Just a cool appstore. ⛄

## 📃 Table of Contents

- [Introduction](#-introduction)
- [Installation](#-installation)
- [List of Applications](#-list-of-applications)
- [Frequently Asked Questions / FAQs](#-frequently-asked-questions)
    - [How to Upgrade CasaOS](#-how-to-upgrade-casaos)
    - ["Error 404: Not Found" during install](#-error-404-not-found-during-install)
    - [How to uninstall the CasaOS Coolstore](#-how-to-uninstall-the-casaos-coolstore)
- [Contributing](#contributing)

---

## 🔥 Introduction

Just an another CasaOS third-party Appstore with ❄**Cool**❄ apps.


---


## ✅ Installation

Run the following command to install the appstore:
```bash
casaos-cli app-management register app-store https://casaos-appstore.paodayag.dev/coolstore.zip
```

> **NOTE: Custom Appstore is only supported on CasaOS version [0.4.4](https://blog.casaos.io/blog/23.html) and above. How to upgrade? [Click here](#-how-to-upgrade-casaos)**

---

## 🛠 List of Applications

%APPSLIST%



## 💡 Frequently Asked Questions

### 👉 How to Upgrade CasaOS

Run the following command:

    curl -fsSL https://get.casaos.io/update/v0.4.4-alpha | sudo bash


### 👉 Error 404 Not Found during install

This could be caused by your CasaOS running on a port other than the default `port 80`. You need to add the `-u` flag at the end to tell command which port your CasaOS is running:

```bash
casaos-cli app-management register app-store https://casaos-appstore.paodayag.dev/coolstore.zip -u "localhost:<my-casa-os-port>"
```

Replace `<my-casa-os-port>` with the port where your CasaOS is running. For example if my CasaOS is running on port 99:

```bash
casaos-cli app-management register app-store https://casaos-appstore.paodayag.dev/coolstore.zip -u "localhost:99"
```

### 👉 How to uninstall the CasaOS Coolstore

Get the assigned ID of the Coolstore:

    casaos-cli app-management list app-stores

Unregister the CasaOS Coolstore:

    casaos-cli app-management unregister app-store <coolstore-id>

> NOTE: Replace `<coolstore-id>` with the corresponding ID of the CasaOS Coolstore.

---


## Contributing

> ☠ WARNING: Please refrain from submitting PRs into this repository.

You can contribute changes or updates to this Appstore through [CasaOS-Cool-Appstore-Generator](https://github.com/WisdomSky/CasaOS-Cool-Appstore-Generator).
