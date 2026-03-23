import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models

class CBAM(nn.Module):
    def __init__(self, channel: int, reduction: int = 16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)  # ← FIXED
        self.max_pool = nn.AdaptiveAvgPool2d(1)

        self.fc1 = nn.Conv2d(channel, channel // reduction, 1, bias=False)
        self.fc2 = nn.Conv2d(channel // reduction, channel, 1, bias=False)

        self.sigmoid = nn.Sigmoid()
        self.spatial_conv = nn.Conv2d(2, 1, kernel_size=7, padding=3, bias=False)

    def forward(self, x):
        avg_out = self.fc2(F.relu(self.fc1(self.avg_pool(x))))
        max_out = self.fc2(F.relu(self.fc1(self.max_pool(x))))
        channel_att = self.sigmoid(avg_out + max_out)
        x = x * channel_att

        avg_spatial = torch.mean(x, dim=1, keepdim=True)
        max_spatial, _ = torch.max(x, dim=1, keepdim=True)
        spatial_att = self.sigmoid(self.spatial_conv(torch.cat([avg_spatial, max_spatial], dim=1)))
        x = x * spatial_att
        return x

class ResNet18Emotion(nn.Module):
    def __init__(self, num_classes: int, use_fourth_channel: bool = True, use_stn: bool = False):
        super().__init__()
        self.resnet = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        in_ch = 4 if use_fourth_channel else 3
        self.resnet.conv1 = nn.Conv2d(in_ch, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.feature_dim = self.resnet.fc.in_features
        self.resnet.fc = nn.Identity()
        self.cbam = CBAM(self.feature_dim)
        self.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(self.feature_dim, num_classes)
        )

    def forward(self, x):
        x = self.resnet.conv1(x)
        x = self.resnet.bn1(x)
        x = self.resnet.relu(x)
        x = self.resnet.maxpool(x)
        x = self.resnet.layer1(x)
        x = self.resnet.layer2(x)
        x = self.resnet.layer3(x)
        x = self.resnet.layer4(x)
        x = self.cbam(x)
        x = self.resnet.avgpool(x)
        feat = torch.flatten(x, 1)
        logits = self.classifier(feat)
        return logits, feat

class EmotionModel:
    def __init__(self, num_classes=7):
        self.model = ResNet18Emotion(num_classes=num_classes, use_fourth_channel=True, use_stn=False)
    
    def load(self, path, device):
        # YOUR OWN CHECKPOINT → weights_only=False is SAFE
        checkpoint = torch.load(path, map_location=device, weights_only=False)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.to(device)
        self.model.eval()
    
    def predict(self, x):
        self.model.eval()
        with torch.no_grad():
            logits, _ = self.model(x)
            return torch.softmax(logits, dim=1)