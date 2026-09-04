import { cloudEvent, type CloudEvent } from '@google-cloud/functions-framework'
import { Storage } from '@google-cloud/storage'
import { processAvatarObject, type StorageObjectFinalizedData } from './processAvatar.js'

const storage = new Storage()

cloudEvent<StorageObjectFinalizedData>('processAvatar', async (event: CloudEvent<StorageObjectFinalizedData>) => {
  const data = event.data
  if (!data) {
    console.error('CloudEvent received without data')
    return
  }

  await processAvatarObject(storage, data)
})
