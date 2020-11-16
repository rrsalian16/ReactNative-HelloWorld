import * as React from 'react';
import {
  Text,
  View,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Constants } from 'expo';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
const { width: screenWidth } = Dimensions.get('window');
import { Carousel } from "./Carousel"

class Item extends React.PureComponent {
  render() {
    return (
      <Image
        source={this.props.source}
        style={{ height: screenWidth, width: screenWidth }}
      />
    );
  }
}

const data = [
  {
    key: 'a',
    source: require('./assets/1.jpg'),
  },
  {
    key: 'b',
    source: require('./assets/2.jpg'),
  },
  {
    key: 'c',
    source: require('./assets/3.jpg'),
  },
];

export default class App extends React.Component {
  state = { position: 0 };
  renderItem = ({ item, index }) => {
    return <Item key={item.key + item.index} source={item.source} />;
  };
  onSnapToPosition = position => this.setState({ position });
  render() {
    return (
      <View style={{ flex: 1, backgroundColor: 'gray' }}>
        <Carousel
          data={data}
          renderItem={this.renderItem}
          onSnapToPosition={this.onSnapToPosition}
        />
        <Text>Pagination: {this.state.position}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({});
