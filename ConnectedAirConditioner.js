'use strict';

var clientFromConnectionString = require('azure-iot-device-mqtt').clientFromConnectionString;
var Message = require('azure-iot-device').Message;
var ConnectionString = require('azure-iot-device').ConnectionString;
var connectionString = 'HostName=iotc-a433fdda-80e5-4136-941a-7e7040208ef4.azure-devices.net;DeviceId=7e24d8b1-e43e-4c38-83d8-043157433856;SharedAccessKey=3644pn9xwmJqf7f+SBIQLN0VVSfeMueS/d17kstNv4c=';
var targetTemperature = 0;
var client = clientFromConnectionString(connectionString);



// Send device telemetry.
function sendTelemetry() {
  var temperature = targetTemperature + (Math.random() * 15);
  var data = JSON.stringify({ temperature: temperature });
  var message = new Message(data);
  client.sendEvent(message, (err, res) => console.log(`Sent message: ${message.getData()}` +
    (err ? `; error: ${err.toString()}` : '') +
    (res ? `; status: ${res.constructor.name}` : '')));
}

// Send device properties
function sendDeviceProperties(twin) {
  var properties = {
    firmwareVersion: "9.75",
    serialNumber: "10001"
  };
  twin.properties.reported.update(properties, (errorMessage) =>
  console.log(` * Sent device properties ` + (errorMessage ? `Error: ${errorMessage.toString()}` : `(success)`)));
}

// Add any settings your device supports
// mapped to a function that is called when the setting is changed.
var settings = {
  'setTemperature': (newValue, callback) => {
    // Simulate the temperature setting taking two steps.
    setTimeout(() => {
      targetTemperature = targetTemperature + (newValue - targetTemperature) / 2;
      callback(targetTemperature, 'pending');
      setTimeout(() => {
        targetTemperature = newValue;
        callback(targetTemperature, 'completed');
      }, 5000);
    }, 5000);
  }
};

// Handle settings changes that come from Azure IoT Central via the device twin.
function handleSettings(twin) {
  twin.on('properties.desired', function (desiredChange) {
    for (let setting in desiredChange) {
      if (settings[setting]) {
        console.log(`Received setting: ${setting}: ${desiredChange[setting].value}`);
        settings[setting](desiredChange[setting].value, (newValue, status, message) => {
          var patch = {
            [setting]: {
              value: newValue,
              status: status,
              desiredVersion: desiredChange.$version,
              message: message
            }
          }
          twin.properties.reported.update(patch, (err) => console.log(`Sent setting update for ${setting}; ` +
            (err ? `error: ${err.toString()}` : `status: success`)));
        });
      }
    }
  });
}

// Respond to the echo command
function onCommandEcho(request, response) {
  // Display console info
  console.log(' * Echo command received');
  // Respond
  response.send(10, 'Success', function (errorMessage) {});
}

// Handle device connection to Azure IoT Central.
var connectCallback = (err) => {
  if (err) {
    console.log(`Device could not connect to Azure IoT Central: ${err.toString()}`);
  } else {
    console.log('Device successfully connected to Azure IoT Central');
    // Send telemetry measurements to Azure IoT Central every 1 second.
    setInterval(sendTelemetry, 1000);
    // Setup device command callbacks
    client.onDeviceMethod('echo', onCommandEcho);
    // Get device twin from Azure IoT Central.
    client.getTwin((err, twin) => {
      if (err) {
        console.log(`Error getting device twin: ${err.toString()}`);
      } else {
        // Send device properties once on device start up
        sendDeviceProperties(twin);
        // Apply device settings and handle changes to device settings.
        handleSettings(twin);
      }
    });
  }
};

client.open(connectCallback);
