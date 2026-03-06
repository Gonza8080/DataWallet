import ExpoModulesCore
import Vision
import UIKit

public class VisionOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisionOcr")

    AsyncFunction("recognizeTextAsync") { (uriString: String) -> [[String: Any]] in
      guard let url = URL(string: uriString), url.isFileURL else {
        throw NSError(domain: "VisionOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid file URI"])
      }

      guard let imageData = try? Data(contentsOf: url),
            let uiImage = UIImage(data: imageData),
            let cgImage = uiImage.cgImage else {
        throw NSError(domain: "VisionOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to load image"])
      }

      return try await withCheckedThrowingContinuation { continuation in
        let request = VNRecognizeTextRequest { request, error in
          if let error = error {
            continuation.resume(throwing: error)
            return
          }

          guard let observations = request.results as? [VNRecognizedTextObservation] else {
            continuation.resume(returning: [])
            return
          }

          var blocks: [[String: Any]] = []
          for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            let text = topCandidate.string
            let box = observation.boundingBox
            blocks.append([
              "text": text,
              "frame": [
                "x": box.origin.x,
                "y": box.origin.y,
                "width": box.size.width,
                "height": box.size.height
              ]
            ])
          }
          continuation.resume(returning: blocks)
        }

        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-US", "ru-RU"]

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
          try handler.perform([request])
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }
}
